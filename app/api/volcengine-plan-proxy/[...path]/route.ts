import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 300;

const VOLCENGINE_PLAN_API_ORIGIN = "https://ark.cn-beijing.volces.com/api/plan/v3";
const ALLOWED_BROWSER_ORIGINS = new Set([
    "https://bovita.netlify.app",
    "https://bovita-float.vercel.app",
]);
const ALLOWED_PATHS = new Set([
    "models",
    "chat/completions",
]);
const MAX_REQUEST_BODY_BYTES = 5 * 1024 * 1024;

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

function responseHeaders(request: NextRequest, contentType?: string | null): Record<string, string> {
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
    return !origin || allowedBrowserOrigin(request) !== null;
}

async function proxyVolcenginePlan(request: NextRequest, context: RouteContext) {
    if (!isAllowedRequestOrigin(request)) {
        return NextResponse.json(
            { error: "Origin is not allowed." },
            { status: 403, headers: responseHeaders(request) },
        );
    }

    const { path = [] } = await context.params;
    const proxyPath = path.join("/");
    if (!ALLOWED_PATHS.has(proxyPath)) {
        return NextResponse.json(
            { error: "Unsupported Volcengine Agent Plan endpoint." },
            { status: 404, headers: responseHeaders(request) },
        );
    }

    const authorization = request.headers.get("authorization");
    if (!authorization?.startsWith("Bearer ")) {
        return NextResponse.json(
            { error: "Missing Bearer Authorization header." },
            { status: 401, headers: responseHeaders(request) },
        );
    }

    const contentLength = Number(request.headers.get("content-length") || "0");
    if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BODY_BYTES) {
        return NextResponse.json(
            { error: "Request body is too large." },
            { status: 413, headers: responseHeaders(request) },
        );
    }

    const target = new URL(`${VOLCENGINE_PLAN_API_ORIGIN}/${proxyPath}`);
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
                { status: 413, headers: responseHeaders(request) },
            );
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
            headers: responseHeaders(request, upstream.headers.get("content-type")),
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return NextResponse.json(
            { error: `Volcengine Agent Plan proxy request failed: ${message}` },
            { status: 502, headers: responseHeaders(request) },
        );
    }
}

export async function GET(request: NextRequest, context: RouteContext) {
    return proxyVolcenginePlan(request, context);
}

export async function POST(request: NextRequest, context: RouteContext) {
    return proxyVolcenginePlan(request, context);
}

export async function OPTIONS(request: NextRequest) {
    if (!allowedBrowserOrigin(request)) {
        return new NextResponse(null, { status: 403, headers: responseHeaders(request) });
    }

    return new NextResponse(null, {
        status: 204,
        headers: {
            ...responseHeaders(request),
            "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
            "Access-Control-Allow-Headers": "Authorization,Content-Type",
            "Access-Control-Max-Age": "86400",
        },
    });
}
