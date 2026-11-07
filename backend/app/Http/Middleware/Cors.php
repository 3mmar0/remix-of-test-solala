<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class Cors
{
    public function handle(Request $request, Closure $next): Response
    {
        $origin = $request->headers->get('Origin');
        $allowed = ['https://solalaa.com', 'https://www.solalaa.com', 'http://localhost:3000', 'http://localhost:5173', 'http://localhost:8080'];
        // Lovable preview/published origins use dynamic subdomains of lovable.app.
        $host = $origin ? (string) (parse_url($origin, PHP_URL_HOST) ?? '') : '';
        $originAllowed = $origin && (in_array($origin, $allowed, true) || str_ends_with($host, '.lovable.app') || $host === 'lovable.app');

        if ($request->getMethod() === 'OPTIONS') {
            $response = response('', 204);
        } else {
            $response = $next($request);
        }

        if ($originAllowed) {
            $response->headers->set('Access-Control-Allow-Origin', $origin);
            $response->headers->set('Vary', 'Origin');
        }

        $response->headers->set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
        $response->headers->set('Access-Control-Allow-Headers', 'Authorization, Content-Type, Accept');
        $response->headers->set('Access-Control-Max-Age', '86400');
        $response->headers->set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');

        return $response;
    }
}
