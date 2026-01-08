# PocketBase Database Setup for Shared Files

## Overview
The shared files feature now uses PocketBase for persistent storage instead of in-memory storage.

## Setting up the Database Collection

### Method 1: Import via PocketBase Admin UI

1. **Access PocketBase Admin UI**
   - Go to your PocketBase admin interface (usually `https://w.zaur.app/_/` or your configured URL)
   - Log in with your admin credentials

2. **Import Collection**
   - Navigate to **Settings** > **Import collections**
   - Copy the contents of `shared_files_collection.json`
   - Paste it into the import field
   - Click **Import**

### Method 2: Manual Collection Creation

If you prefer to create the collection manually:

1. Go to **Collections** in PocketBase Admin
2. Click **+ New collection**
3. Set **Collection name** to `shared_files`
4. Add the following fields:

| Field Name | Type | Required | Unique | Notes |
|------------|------|----------|--------|-------|
| `shareId` | Text | ✓ | ✓ | Unique identifier for sharing |
| `filename` | Text | ✓ | ✗ | Original filename |
| `data` | JSON | ✓ | ✗ | Survey data array |
| `columns` | JSON | ✓ | ✗ | Column names array |
| `uploadedAt` | Text | ✓ | ✗ | Original upload timestamp |
| `contentHash` | Text | ✓ | ✗ | SHA-256 hash for deduplication |

5. **Create Indexes**: 
   - Add a unique index on `shareId` field for fast lookups
   - Add an index on `contentHash` field for deduplication queries

## Collection Schema Details

```json
{
  "name": "shared_files",
  "type": "base", 
  "schema": [
    {
      "name": "shareId",
      "type": "text",
      "required": true,
      "unique": true
    },
    {
      "name": "filename", 
      "type": "text",
      "required": true
    },
    {
      "name": "data",
      "type": "json",
      "required": true
    },
    {
      "name": "columns",
      "type": "json",
      "required": true
    },
    {
      "name": "uploadedAt",
      "type": "text", 
      "required": true
    },
    {
      "name": "contentHash",
      "type": "text",
      "required": true
    }
  ]
}
```

## Benefits of Database Storage

✅ **Persistent Storage** - Files survive server restarts  
✅ **Scalable** - Works across multiple server instances  
✅ **Backup & Recovery** - PocketBase handles data persistence  
✅ **Query Performance** - Indexed lookups for fast retrieval  
✅ **Data Integrity** - ACID compliance and validation  
✅ **Deduplication** - Identical files share the same storage and link  

## API Endpoints

- **POST** `/api/v1/shared-files` - Save a new shared file
- **GET** `/api/v1/shared-files?id={shareId}` - Retrieve a shared file

## Security Notes

- Currently, no authentication is required for sharing files
- Consider adding access controls based on your security requirements
- The `shareId` is a cryptographically secure random string (32 hex characters)

## Troubleshooting

If you encounter issues:

1. **Collection not found**: Ensure the `shared_files` collection exists in PocketBase
2. **Permission errors**: Check PocketBase collection rules (currently set to allow all operations)
3. **Connection issues**: Verify `POCKETBASE_URL` environment variable is set correctly 

---

## Fix Field of View Relations Migration

### Issue Description
The `field_of_view` and `field_of_view_gaps` collections have both a text field `report_id` and a relation field `report`. The external sync process only populates the `report_id` text field, leaving the `report` relation field empty. This breaks the proper database relationships.

### Affected Collections
- `field_of_view` - Has `report_id` populated but `report` relation empty
- `field_of_view_gaps` - Has `report_id` populated but `report` relation empty
- `gas_reports` - May not have all reverse relations populated

### Migration Methods

#### Method 1: JavaScript Migration (Recommended)
1. Access PocketBase Admin UI at `https://w.zaur.app/_/`
2. Navigate to **Settings** > **Execute JavaScript**
3. Copy the contents of `003_fix_field_of_view_relations.js`
4. Paste and execute the script
5. Monitor console output for progress

#### Method 2: API Endpoint (For Admin Users)
```bash
# Execute the fix via API (requires admin authentication)
curl -X POST https://your-app.com/api/v1/fix-relations \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -H "Content-Type: application/json"
```

### What the Migration Does
1. **field_of_view**: Finds records with `report_id` but no `report` relation, looks up the matching report in `gas_reports` by `report_id`, and updates the relation
2. **field_of_view_gaps**: Same process as above
3. **gas_reports**: Updates the reverse relations to ensure all related `field_of_view` and `field_of_view_gaps` records are linked

### Important Notes
- The migration is idempotent - safe to run multiple times
- Only affects records with missing relations
- Processes in batches to avoid timeouts
- Logs progress and any errors to console

### Preventing Future Issues
The root cause is the external sync process not populating relation fields. To prevent this:
1. Update the external sync process to set both `report_id` and `report` fields
2. Or run this migration periodically as a maintenance task
3. Consider adding a PocketBase hook to automatically populate the relation when `report_id` is set 