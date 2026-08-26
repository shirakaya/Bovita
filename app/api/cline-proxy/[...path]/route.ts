import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 300;

const CLINE_API_ORIGIN = "https://api.cline.bot/api";
const ALLOWED_ORIGIN = "https://bovita.netlify.app";
const ALLOWED_PATHS = new Set([
    "v1/models",
    "v1/chat/completions",
]);
const STREAM_HEARTBEAT_INTERVAL_MS = 10_000;
const MAX_REQUEST_BODY_BYTES = 5 * 1024 * 1024;

type RouteContext = {
    params: Promise<{ path?: string[] }>;
};

function corsHeaders(contentType?: string | null): Record<string, string> {
    return {
        "Content-Type": contentType || "application/json",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
        Vary: "Origin",
    };
}

function isAllowedBrowserOrigin(request: NextRequest): boolean {
    return request.headers.get("origin") === ALLOWED_ORIGIN;
}

async function proxyCline(request: NextRequest, context: RouteContext) {
    if (!isAllowedBrowserOrigin(request)) {
        return NextResponse.json(
            { error: "Origin is not allowed." },
            { status: 403, headers: corsHeaders() },
        );
    }

    const { path = [] } = await context.params;
    const proxyPath = path.join("/");

    if (!ALLOWED_PATHS.has(proxyPath)) {
        return NextResponse.json(
            { error: "Unsupported Cline API endpoint." },
            { status: 404, headers: corsHeaders() },
        );
    }

    const authorization = request.headers.get("authorization");
    if (!authorization?.startsWith("Bearer ")) {
        return NextResponse.json(
            { error: "Missing Bearer Authorization header." },
            { status: 401, headers: corsHeaders() },
        );
    }

    const contentLength = Number(request.headers.get("content-length") || "0");
    if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BODY_BYTES) {
        return NextResponse.json(
            { error: "Request body is too large." },
            { status: 413, headers: corsHeaders() },
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
                { status: 413, headers: corsHeaders() },
            );
        }

        let isStreamingChatRequest = false;
        if (proxyPath === "v1/chat/completions" && body) {
            try {
                const payload = JSON.parse(new TextDecoder().decode(body)) as { stream?: unknown };
                isStreamingChatRequest = payload.stream === true;
            } catch {
                // Forward malformed JSON so Cline can return its normal API error.
            }
        }

        if (isStreamingChatRequest) {
            const encoder = new TextEncoder();
            const stream = new ReadableStream<Uint8Array>({
                start(controller) {
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
                                    `data: ${JSON.stringify({
                                        error: {
                                            message: `Cline API error ${upstream.status}: ${errorBody}`,
                                            status: upstream.status,
                                        },
                                    })}\n\n`,
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
                            while (true) {
                                const { done, value } = await reader.read();
                                if (done) break;
                                controller.enqueue(value);
                            }
                        } catch (error) {
                            const message = error instanceof Error ? error.message : String(error);
                            controller.enqueue(encoder.encode(
                                `data: ${JSON.stringify({ error: { message: `Cline proxy request failed: ${message}` } })}\n\n`,
                            ));
                        } finally {
                            clearInterval(heartbeat);
                            controller.close();
                        }
                    })();
                },
            });

            return new NextResponse(stream, {
                status: 200,
                headers: {
                    ...corsHeaders("text/event-stream; charset=utf-8"),
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

        return new NextResponse(upstream.body, {
            status: upstream.status,
            headers: corsHeaders(upstream.headers.get("content-type")),
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return NextResponse.json(
            { error: `Cline proxy request failed: ${message}` },
            { status: 502, headers: corsHeaders() },
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
    if (!isAllowedBrowserOrigin(request)) {
        return new NextResponse(null, { status: 403, headers: corsHeaders() });
    }

    return new NextResponse(null, {
        status: 204,
        headers: {
            ...corsHeaders(),
            "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
            "Access-Control-Allow-Headers": "Authorization,Content-Type",
            "Access-Control-Max-Age": "86400",
        },
    });
}
