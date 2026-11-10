# Chat sessions and saved-look fixes

## Repository changes

The lookbook now reads owned outfits and outfit-item relationships in separate owner-filtered queries. This avoids the ambiguous PostgREST relationship caused by both the original outfit foreign key and the composite ownership foreign key pointing at outfits. No saved data is removed or resaved.

The AI Stylist's Save look buttons now use saved outfit IDs returned from the database. They display Saved with a checkmark and are disabled when the candidate is already saved, including when the agent saved it during conversation. State survives refresh and switching chats. If that saved look is deleted, refreshing the chat makes its original candidate saveable again.

New chat and Previous chats controls provide persistent, separate conversations. Chats have a first-message title and a stable URL (`/stylist?chat=...`). The server scopes message history, candidates, tool logs and pending approvals to the selected owned chat. Wardrobe, Style DNA and the lookbook remain shared across the user's chats. Creating a new chat does not delete earlier messages or saved outfits and makes no model request.

## Required database upgrade

1. Open Supabase Dashboard > `outfyt` > SQL Editor.
2. Run `supabase/migrations/0004_chat_sessions.sql` once, after 0003.
3. Existing messages are assigned to a chat titled Previous conversation. Existing saved outfits are untouched. Do not rerun or delete older migrations.
4. In a separate query, run `supabase/checks/chats.sql`. Expect a PASS result; all fixture data rolls back and no email or AI requests are made.
5. Restart `npm run dev`, sign in and open AI Stylist.

## Manual acceptance tests

| Test | Expected result |
| --- | --- |
| Open My Lookbook with an existing saved look | Look and its actual clothing photos load without the relationship error |
| Save a new candidate in AI Stylist | Button changes to Saved only after the successful write |
| Refresh the chat | The button still says Saved |
| Ask the agent to generate and save a look | Its candidate also displays Saved |
| Click New chat | Empty, separate conversation; previous chat remains in selector |
| Open Previous conversation / select an older chat | Original messages and outfit cards return |
| Send different requests in two chats | Titles and histories stay separate |
| Save a look, start a new chat, then open My Lookbook | The look is still saved; chats do not own/delete outfits |
| Reopen a chat URL after refresh | The same selected conversation loads |
| Try another user's chat URL or chat ID | Access denied; no messages or approvals leak |

Reference-photo search was subsequently connected; setup and tests are in `docs/PHOTO_SETUP.md`. Style DNA preferences and inspiration uploads are now implemented separately; follow `docs/MILESTONE_4.md` for migration 0006.
