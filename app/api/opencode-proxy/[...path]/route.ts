import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 120;

const OPENCODE_GO_ORIGIN = "https://opencode.ai/zen/go";
const ALLOWED_PATHS = new Set([
    "v1/models",
    "v1/chat/completions",
    "v1/embeddings",
]);
const STREAM_HEARTBEAT_INTERVAL_MS = 10_000;

type RouteContext = {
    params: Promise<{ path?: string[] }>;
};

function responseHeaders(contentType?: string | null): Record<string, string> {
    return {
        "Content-Type": contentType || "application/json",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Access-Control-Allow-Origin": "*",
    };
}

async function proxyOpenCodeGo(request: NextRequest, context: RouteContext) {
    const { path = [] } = await context.params;
    const proxyPath = path.join("/");

    if (!ALLOWED_PATHS.has(proxyPath)) {
        return NextResponse.json(
            { error: "Unsupported OpenCode Go endpoint." },
            { status: 404, headers: responseHeaders() },
        );
    }

    const authorization = request.headers.get("authorization");
    if (!authorization) {
        return NextResponse.json(
            { error: "Missing Authorization header." },
            { status: 401, headers: responseHeaders() },
        );
    }

    const target = new URL(`${OPENCODE_GO_ORIGIN}/${proxyPath}`);
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

        let isStreamingChatRequest = false;
        if (proxyPath === "v1/chat/completions" && body) {
            try {
                const payload = JSON.parse(new TextDecoder().decode(body)) as { stream?: unknown };
                isStreamingChatRequest = payload.stream === true;
            } catch {
                // Let OpenCode return the appropriate error for malformed JSON.
            }
        }

        if (isStreamingChatRequest) {
            const encoder = new TextEncoder();
            const stream = new ReadableStream<Uint8Array>({
                start(controller) {
                    // Send response headers and a harmless SSE comment immediately so
                    // Netlify's inactivity timeout does not fire while the model is
                    // still reasoning before its first token.
                    controller.enqueue(encoder.encode(": opencode-proxy-connected\n\n"));

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
                                            message: `OpenCode API error ${upstream.status}: ${errorBody}`,
                                            status: upstream.status,
                                        },
                                    })}\n\n`,
                                ));
                                return;
                            }

                            if (!upstream.body) {
                                controller.enqueue(encoder.encode(
                                    `data: ${JSON.stringify({ error: { message: "OpenCode returned an empty response body." } })}\n\n`,
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
                                `data: ${JSON.stringify({ error: { message: `OpenCode Go proxy request failed: ${message}` } })}\n\n`,
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
                    ...responseHeaders("text/event-stream; charset=utf-8"),
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
            headers: responseHeaders(upstream.headers.get("content-type")),
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return NextResponse.json(
            { error: `OpenCode Go proxy request failed: ${message}` },
            { status: 502, headers: responseHeaders() },
        );
    }
}

export async function GET(request: NextRequest, context: RouteContext) {
    return proxyOpenCodeGo(request, context);
}

export async function POST(request: NextRequest, context: RouteContext) {
    return proxyOpenCodeGo(request, context);
}

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
            "Access-Control-Allow-Headers": "Authorization,Content-Type",
            "Access-Control-Max-Age": "86400",
            "Cache-Control": "no-store",
        },
    });
}
