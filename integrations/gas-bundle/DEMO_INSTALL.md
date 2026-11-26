# Existing LINE reception DEMO only
Do not create a new environment. Verify actual script, spreadsheet and private Drive root are DEMO, not production, before editing. The old web app URL is not proof of script identity.
1. Back up existing code. Install GF_DocumentCombined.gs and GF_DocumentPreflight.gs. Do not install the four individual adapters alongside the bundle.
2. In existing doPost(e), before existing dispatch, add:
```js
const gfDocumentResponse = GF_DocumentCombinedRoute_(e);
if (gfDocumentResponse !== null) return gfDocumentResponse;
```
Do not replace existing doPost. Enable advanced Drive v3 and Sheets v4 if absent.
3. Script properties:
- GF_DOCUMENT_ENV=DEMO
- GF_DOCUMENT_DEMO_SCRIPT_ID=verified existing DEMO script ID
- GF_DOCUMENT_DEMO_SHEET_ID=verified DEMO receipt spreadsheet ID
- GF_DOCUMENT_APPROVAL_SHEET_ID=same verified DEMO spreadsheet ID
- GF_DOCUMENT_DEMO_FOLDER_ID=verified private DEMO document root ID
- GF_DOCUMENT_DRIVE_ALLOWED_EMAILS=comma-separated approved individual emails
- GF_DOCUMENT_BRIDGE_SECRET=unique test secret at least 32 characters; never send in chat
- GF_DOCUMENT_RESUBMISSION_WRITE_ENABLED=NO
- GF_DOCUMENT_APPROVAL_WRITE_ENABLED=NO
4. Run GF_DocumentPreflight; all checks must be true. This is a read-only diagnostic, not proof of actual environment isolation. Verify actual IDs independently.
5. Update existing DEMO web app deployment only after verifying identity and preflight. Preserve access and execution settings. Keep both write flags NO. Verify existing LINE reception and disabled bridge response.
6. Test Supabase stage v8 has hard-disabled writes. Activation requires a separate reviewed redeployment and matching test secret and URL. Never enable production. Do not enable writes until test target, permissions and routing are verified. Rollback: both flags NO and retain hard-disabled Supabase deployment.
