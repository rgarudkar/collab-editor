import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

// No routes are strictly protected at the edge anymore.
// We handle Auth dynamically on the frontend via <SignedIn> and <SignedOut>
export default clerkMiddleware(() => {
    // Let everything pass through
});

export const config = {
    matcher: [
        // Skip Next.js internals and all static files, unless found in search params
        '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
        // Always run for API routes
        '/(api|trpc)(.*)',
    ],
}
