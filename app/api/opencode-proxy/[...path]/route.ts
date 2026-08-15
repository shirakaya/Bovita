import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 120;

const OPENCODE_GO_ORIGIN = "https://opencode.ai/zen/go";
const ALLOWED_PATHS = new Set([
    "v1/models",
    "v1/chat/completions",
    "v1/embeddings",
]);

type RouteContext = {
    params: Promise<{ path?: string[] }>;
};

function responseHeaders(contentType?: string | null): HeadersInit {
    return {
        "Content-Type": contentType || "application/json",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
    };
}

function rejectCrossOriginBrowserRequest(request: NextRequest): NextResponse | null {
    const origin = request.headers.get("origin");
    if (!origin || origin === new URL(request.url).origin) return null;

    return NextResponse.json(
        { error: "Cross-origin use of this proxy is not allowed." },
        { status: 403, headers: responseHeaders() },
    );
}

async function proxyOpenCodeGo(request: NextRequest, context: RouteContext) {
    const crossOriginResponse = rejectCrossOriginBrowserRequest(request);
    if (crossOriginResponse) return crossOriginResponse;

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

export async function OPTIONS(request: NextRequest) {
    const crossOriginResponse = rejectCrossOriginBrowserRequest(request);
    if (crossOriginResponse) return crossOriginResponse;

    return new NextResponse(null, {
        status: 204,
        headers: {
            "Access-Control-Allow-Origin": new URL(request.url).origin,
            "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
            "Access-Control-Allow-Headers": "Authorization,Content-Type",
            "Access-Control-Max-Age": "86400",
            "Cache-Control": "no-store",
            Vary: "Origin",
        },
    });
}
