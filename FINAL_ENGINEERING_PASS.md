# Contrest — final engineering pass

## Completed in this pass
- Added first-class shareable routes for `/post/:postId`, `/messages/:conversationId`, and `/u/:username-or-id`.
- ShareSheet now generates `/post/:postId` links instead of query-only post links.
- Messages can open a specific conversation from its URL.
- Added a database security boundary for story visibility, including private accounts and block relationships.
- Story view insertion now requires that the viewer can actually view the story.
- Added hot-query indexes for unread notifications, comments, likes, posts and story views.
- Added keyboard focus-visible styling and OS reduced-motion support.
- Preserved the existing security hardening from the previous pass.

## Verification limitation
`npm install` could not complete in the available environment because the package installation timed out. Therefore `npm run typecheck`, `npm run lint`, and `npm run build` were not honestly marked as passed.

## Deployment action
Apply all migrations through `20260912140000_story_and_query_hardening.sql` in the Supabase project before deploying the frontend.
