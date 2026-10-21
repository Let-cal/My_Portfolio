# Preview and translation editing

## Preview saved hidden content

Open a saved item in `/admin`, then choose **Xem trước nội dung đã lưu**. The new tab shows the normal portfolio, including saved hidden experiences, projects and certificates. Unsaved edits are not included. Use the site's language control for EN, JA or VI.

The preview banner identifies this mode. **Thoát xem trước** submits a same-origin POST, clears the draft cookie and returns to the public page. The preview cookie belongs to this browser origin; other visitors do not receive it.

The entry route accepts only supported locales and local section/item anchors. It verifies the admin session before enabling Next.js Draft Mode. Every preview render validates authorization again, so possession of a draft cookie alone cannot reveal hidden content. An expired or non-admin session falls back to public published data. Preview read failures are reported instead of silently substituting seed content.

The anonymous `use cache` loader remains separate from cookie-based reads. Preview content is request scoped, has no shared cache entry, and uses a render-only clone to include hidden rows; it never changes their database publish flags. Authorized preview metadata is `noindex, nofollow`.

## Translation progress

Lists and editors show EN/JA/VI counts using the same counter as the content health checks. Editors update counts as you type. The denominator counts text fields with nonempty English; missing JA/VI properties count as empty. Plain fields such as certificate names are not translation fields. These counts measure filled fields, not linguistic accuracy.

The existing **Chép từ EN** action fills an empty destination as a draft for manual editing. It does not call a translation service or overwrite populated translations. **Cả 3 / EN / JA / VI** remembers the editing mode in local storage. Validation errors in a hidden language remain discoverable.

## Preview review checklist

Preview and production share the database. Use only a hidden disposable `test-item`.

- Save the hidden item, open its saved preview and confirm it appears at the correct section. Check all three languages.
- Open the public site in a separate private browser context without an admin session: the item must remain hidden and the preview banner absent.
- Edit without saving: preview must still show the last saved version.
- Exit preview: the banner disappears and the hidden item is excluded again.
- Sign out while preview is open, then reload: no hidden content may be returned.
- Verify translation counts change while editing; copying English never replaces an existing translation, and language mode survives reopening.
- Remove the disposable item after review. No schema migration is needed for this batch.

Automated checks cover route authorization, safe redirects, same-origin exit, anonymous cache policy, hidden-row render adaptation, live editor progress and existing translation tools. A real authenticated preview walkthrough is a separate manual check, not implied by mocked tests.
