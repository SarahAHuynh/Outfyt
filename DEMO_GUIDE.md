# Outfyt class demo (1–2 minutes)

Prerequisites: migrations 0001–0003 applied, live AI key/model verified, signed-in test account, and actual wardrobe photos for at least two complete combinations (including shoes). Use an account you control; never expose keys or another user's data. Keep My Lookbook open in another tab if convenient.

1. **Show the closet (10 seconds).** Point out real uploaded garments and explain that the agent can only use these owned IDs.
2. **Generate and save (30–45 seconds).** In AI Stylist, ask: “Make me two casual brunch outfits from my closet and save the first one.” Expected: live execution stages, real-photo outfit cards and a tool-confirmed save. If the wardrobe is limited, demonstrate the honest missing-piece response instead of claiming success.
3. **Show persistence (10 seconds).** Open My Lookbook and refresh. Expected: the saved combination persists. Favorite it.
4. **Modify through conversation (20–30 seconds).** Ask: “Rename the outfit you just saved to Campus brunch.” Expected: the agent identifies the saved look, calls update_outfit and confirms the actual database result. Refresh the lookbook to show the new name.
5. **Demonstrate safety (20 seconds).** Ask: “Delete Campus brunch.” Expected: an approval card, with the outfit still present. Choose Keep unchanged to demonstrate rejection, or Confirm deletion if you want to remove this test look.
6. **Open Action history (10 seconds).** Show tool names, completed/rejected status and approval state. Explain the role prompt, strict schemas, exact-ID grounding, ownership checks and executable database tools.

If the API is unavailable, show the actual error and existing action history. Automated tests mock external services; the live demo uses the configured real provider.
