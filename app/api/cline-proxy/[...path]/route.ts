import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 300;

const CLINE_API_ORIGIN = "https://api.cline.bot/api";
const ALLOWED_BROWSER_ORIGINS = new Set([
    "https://bovita.netlify.app",
    "https://bovita-float.vercel.app",
]);
const ALLOWED_PATHS = new Set([
    "v1/models",
    "v1/chat/completions",
]);
const STREAM_HEARTBEAT_INTERVAL_MS = 10_000;
const MAX_REQUEST_BODY_BYTES = 5 * 1024 * 1024;

function normalizeSsePayload(rawData: string): string {
    if (rawData === "[DONE]") return "data: [DONE]\n\n";

    try {
        const parsed = JSON.parse(rawData) as {
            data?: unknown;
            success?: unknown;
            choices?: Array<{
                delta?: unknown;
                message?: {
                    role?: unknown;
                    content?: unknown;
                    reasoning_content?: unknown;
                };
                [key: string]: unknown;
            }>;
            [key: string]: unknown;
        };
        const payload = parsed.success === true && parsed.data !== undefined
            ? parsed.data
            : parsed;

        if (payload && typeof payload === "object") {
            const completion = payload as typeof parsed;
            if (Array.isArray(completion.choices)) {
                completion.choices = completion.choices.map((choice) => {
                    if (choice.delta !== undefined || !choice.message) return choice;

                    const { role, content, reasoning_content } = choice.message;
                    return {
                        ...choice,
                        delta: {
                            ...(typeof role === "string" ? { role } : {}),
                            ...(typeof content === "string" ? { content } : {}),
                            ...(typeof reasoning_content === "string"
                                ? { reasoning_content }
                                : {}),
                        },
                    };
                });
            }
        }

        return `data: ${JSON.stringify(payload)}\n\n`;
    } catch {
        return `data: ${rawData}\n\n`;
    }
}

type ClineStreamDiagnostics = {
    eventCount: number;
    doneSeen: boolean;
    contentCandidateEvents: number;
    errorCandidateEvents: number;
    shapes: Set<string>;
};

function inspectSsePayloadStructure(rawData: string, diagnostics: ClineStreamDiagnostics): void {
    diagnostics.eventCount += 1;
    if (rawData === "[DONE]") {
        diagnostics.doneSeen = true;
        return;
    }

    try {
        const parsed = JSON.parse(rawData) as Record<string, unknown>;
        const envelope = parsed.success === true && parsed.data && typeof parsed.data === "object"
            ? parsed.data as Record<string, unknown>
            : parsed;
        const choice = Array.isArray(envelope.choices) && envelope.choices[0] && typeof envelope.choices[0] === "object"
            ? envelope.choices[0] as Record<string, unknown>
            : {};
        const delta = choice.delta && typeof choice.delta === "object"
            ? choice.delta as Record<string, unknown>
            : {};
        const message = choice.message && typeof choice.message === "object"
            ? choice.message as Record<string, unknown>
            : {};
        const dataKeys = parsed.data && typeof parsed.data === "object" && !Array.isArray(parsed.data)
            ? Object.keys(parsed.data as Record<string, unknown>).sort().slice(0, 12)
            : [];
        const shape = [
            `top=${Object.keys(parsed).sort().slice(0, 12).join(",") || "-"}`,
            `data=${dataKeys.join(",") || "-"}`,
            `choice=${Object.keys(choice).sort().slice(0, 12).join(",") || "-"}`,
            `delta=${Object.keys(delta).sort().slice(0, 12).join(",") || "-"}`,
            `message=${Object.keys(message).sort().slice(0, 12).join(",") || "-"}`,
        ].join("|");
        if (diagnostics.shapes.size < 12) diagnostics.shapes.add(shape);

        const contentCandidates = [
            delta.content,
            message.content,
            choice.text,
            envelope.content,
            envelope.text,
            envelope.response,
            envelope.output,
        ];
        if (contentCandidates.some(value =>
            (typeof value === "string" && value.length > 0)
            || (Array.isArray(value) && value.length > 0)
            || (value && typeof value === "object")
        )) {
            diagnostics.contentCandidateEvents += 1;
        }
        if (parsed.error !== undefined || envelope.error !== undefined || parsed.success === false) {
            diagnostics.errorCandidateEvents += 1;
        }
    } catch {
        if (diagnostics.shapes.size < 12) diagnostics.shapes.add("non-json");
    }
}

type RouteContext = {
    params: Promise<{ path?: string[] }>;
};

function allowedBrowserOrigin(request: NextRequest): string | null {
    const origin = request.headers.get("origin");
    if (!origin) return null;

    const requestOrigin = new URL(request.url).origin;
    return origin === requestOrigin || ALLOWED_BROWSER_ORIGINS.has(origin)
        ? origin
        : null;
}

function corsHeaders(request: NextRequest, contentType?: string | null): Record<string, string> {
    const origin = allowedBrowserOrigin(request);
    return {
        "Content-Type": contentType || "application/json",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        ...(origin ? { "Access-Control-Allow-Origin": origin } : {}),
        Vary: "Origin",
    };
}

function isAllowedRequestOrigin(request: NextRequest): boolean {
    const origin = request.headers.get("origin");
    // 浏览器跨站 POST 会携带 Origin，仍须命中白名单；Supabase Edge Function
    // 等服务端重放请求通常不带 Origin，由后续 Bearer 鉴权和路径白名单约束。
    return !origin || allowedBrowserOrigin(request) !== null;
}

async function proxyCline(request: NextRequest, context: RouteContext) {
    if (!isAllowedRequestOrigin(request)) {
        return NextResponse.json(
            { error: "Origin is not allowed." },
            { status: 403, headers: corsHeaders(request) },
        );
    }

    const { path = [] } = await context.params;
    const proxyPath = path.join("/");

    if (!ALLOWED_PATHS.has(proxyPath)) {
        return NextResponse.json(
            { error: "Unsupported Cline API endpoint." },
            { status: 404, headers: corsHeaders(request) },
        );
    }

    const authorization = request.headers.get("authorization");
    if (!authorization?.startsWith("Bearer ")) {
        return NextResponse.json(
            { error: "Missing Bearer Authorization header." },
            { status: 401, headers: corsHeaders(request) },
        );
    }

    const contentLength = Number(request.headers.get("content-length") || "0");
    if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BODY_BYTES) {
        return NextResponse.json(
            { error: "Request body is too large." },
            { status: 413, headers: corsHeaders(request) },
        );
    }

    const target = new URL(`${CLINE_API_ORIGIN}/${proxyPath}`);
    target.search = new URL(request.url).search;

    const headers = new Headers({
        Authorization: authorization,
        Accept: request.headers.get("accept") || "application/json",
    });
    const contentType = request.headers.get("content-type");
    if (contentType) headers.set("Content-Type", contentType);

    try {
        const body = request.method === "GET" || request.method === "HEAD"
            ? undefined
            : await request.arrayBuffer();

        if (body && body.byteLength > MAX_REQUEST_BODY_BYTES) {
            return NextResponse.json(
                { error: "Request body is too large." },
                { status: 413, headers: corsHeaders(request) },
            );
        }

        let isStreamingChatRequest = false;
        let requestModel = "";
        if (proxyPath === "v1/chat/completions" && body) {
            try {
                const payload = JSON.parse(new TextDecoder().decode(body)) as { stream?: unknown; model?: unknown };
                isStreamingChatRequest = payload.stream === true;
                requestModel = typeof payload.model === "string" ? payload.model : "";
            } catch {
                // Forward malformed JSON so Cline can return its normal API error.
            }
        }

        if (isStreamingChatRequest) {
            const encoder = new TextEncoder();
            const diagnostics: ClineStreamDiagnostics = {
                eventCount: 0,
                doneSeen: false,
                contentCandidateEvents: 0,
                errorCandidateEvents: 0,
                shapes: new Set<string>(),
            };
            const stream = new ReadableStream<Uint8Array>({
                start(controller) {
                    const enqueueNormalizedPayload = (rawData: string) => {
                        inspectSsePayloadStructure(rawData, diagnostics);
                        controller.enqueue(encoder.encode(normalizeSsePayload(rawData)));
                    };
                    controller.enqueue(encoder.encode(": cline-proxy-connected\n\n"));

                    const heartbeat = setInterval(() => {
                        try {
                            controller.enqueue(encoder.encode(": keep-alive\n\n"));
                        } catch {
                            clearInterval(heartbeat);
                        }
                    }, STREAM_HEARTBEAT_INTERVAL_MS);

                    void (async () => {
                        try {
                            const upstream = await fetch(target, {
                                method: request.method,
                                headers,
                                body,
                                cache: "no-store",
                                redirect: "follow",
                            });
                            if (!upstream.ok) {
                                const errorBody = await upstream.text();
                                controller.enqueue(encoder.encode(
                                    `data: ${JSON.stringify({ error: { message: `Cline API error ${upstream.status}: ${errorBody}`, status: upstream.status } })}\n\n`,
                                ));
                                return;
                            }
                            if (!upstream.body) {
                                controller.enqueue(encoder.encode(
                                    `data: ${JSON.stringify({ error: { message: "Cline returned an empty response body." } })}\n\n`,
                                ));
                                return;
                            }

                            const reader = upstream.body.getReader();
                            const decoder = new TextDecoder();
                            let pending = "";
                            while (true) {
                                const { done, value } = await reader.read();
                                pending += decoder.decode(value, { stream: !done });

                                const events = pending.split(/\r?\n\r?\n/);
                                pending = events.pop() || "";

                                for (const event of events) {
                                    const dataLines = event
                                        .split(/\r?\n/)
                                        .filter((line) => line.startsWith("data:"))
                                        .map((line) => line.slice(5).trimStart());

                                    if (dataLines.length > 0) {
                                        enqueueNormalizedPayload(dataLines.join("\n"));
                                    } else if (event.trim().startsWith("{")) {
                                        enqueueNormalizedPayload(event.trim());
                                    }
                                }

                                if (done) break;
                            }

                            if (pending.trim()) {
                                const dataLines = pending
                                    .split(/\r?\n/)
                                    .filter((line) => line.startsWith("data:"))
                                    .map((line) => line.slice(5).trimStart());
                                const rawData = dataLines.length > 0
                                    ? dataLines.join("\n")
                                    : pending.trim();
                                if (rawData === "[DONE]" || rawData.startsWith("{")) {
                                    enqueueNormalizedPayload(rawData);
                                }
                            }
                        } catch (error) {
                            const message = error instanceof Error ? error.message : String(error);
                            controller.enqueue(encoder.encode(
                                `data: ${JSON.stringify({ error: { message: `Cline proxy request failed: ${message}` } })}\n\n`,
                            ));
                        } finally {
                            console.info("[cline-proxy] stream summary", {
                                model: requestModel,
                                eventCount: diagnostics.eventCount,
                                doneSeen: diagnostics.doneSeen,
                                contentCandidateEvents: diagnostics.contentCandidateEvents,
                                errorCandidateEvents: diagnostics.errorCandidateEvents,
                                shapes: [...diagnostics.shapes],
                            });
                            clearInterval(heartbeat);
                            controller.close();
                        }
                    })();
                },
            });

            return new NextResponse(stream, {
                status: 200,
                headers: {
                    ...corsHeaders(request, "text/event-stream; charset=utf-8"),
                    Connection: "keep-alive",
                    "X-Accel-Buffering": "no",
                },
            });
        }

        const upstream = await fetch(target, {
            method: request.method,
            headers,
            body,
            cache: "no-store",
            redirect: "follow",
        });

        const upstreamContentType = upstream.headers.get("content-type");
        if (upstreamContentType?.includes("application/json")) {
            const responseText = await upstream.text();

            try {
                const payload = JSON.parse(responseText) as {
                    data?: unknown;
                    success?: unknown;
                };

                // Cline currently wraps non-streaming OpenAI responses as
                // { data: <completion>, success: true }. Float expects choices
                // (or model data) at the top level, so remove only that envelope.
                if (payload.success === true && payload.data !== undefined) {
                    return new NextResponse(JSON.stringify(payload.data), {
                        status: upstream.status,
                        headers: corsHeaders(request, "application/json"),
                    });
                }
            } catch {
                // Preserve Cline's original body if it is not valid JSON.
            }

            return new NextResponse(responseText, {
                status: upstream.status,
                headers: corsHeaders(request, upstreamContentType),
            });
        }

        return new NextResponse(upstream.body, {
            status: upstream.status,
            headers: corsHeaders(request, upstreamContentType),
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return NextResponse.json(
            { error: `Cline proxy request failed: ${message}` },
            { status: 502, headers: corsHeaders(request) },
        );
    }
}

export async function GET(request: NextRequest, context: RouteContext) {
    return proxyCline(request, context);
}

export async function POST(request: NextRequest, context: RouteContext) {
    return proxyCline(request, context);
}

export async function OPTIONS(request: NextRequest) {
    if (!allowedBrowserOrigin(request)) {
        return new NextResponse(null, { status: 403, headers: corsHeaders(request) });
    }

    return new NextResponse(null, {
        status: 204,
        headers: {
            ...corsHeaders(request),
            "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
            "Access-Control-Allow-Headers": "Authorization,Content-Type",
            "Access-Control-Max-Age": "86400",
        },
    });
}
