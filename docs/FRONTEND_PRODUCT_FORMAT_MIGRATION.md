# Frontend Migration: Product Format is now Database-Driven

## Overview

The backend no longer uses a hard-coded `ProductFormat` enum. Product formats are now stored in the `fnf_product_format` reference table and exposed through new REST endpoints.

This guide describes the changes frontend code must make to support the new database-driven product format model.

## What changed

| Before | After |
|--------|-------|
| `format` was an enum with fixed values (`WHOLE`, `CUT`, `JUICE`) | `format` is a free-form string code referencing `fnf_product_format.format_code` |
| Frontend could hard-code format options | Frontend must fetch active formats from `GET /api/v1/product-formats` |
| Format display labels were hard-coded | Display labels come from `formatName` returned by the API |
| New formats required backend + enum + OpenAPI changes | New formats can be added via `POST /api/v1/product-formats` |

## New backend endpoints

Base path: `/api/v1/product-formats`

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/api/v1/product-formats?active=true` | SYSTEM_USER, STAFF, CUSTOMER | List active product formats |
| POST | `/api/v1/product-formats` | SYSTEM_USER with company scope | Create a new format |
| PUT | `/api/v1/product-formats/{formatCode}` | SYSTEM_USER with company scope | Update an existing format |

### Request/response shape

`GET /api/v1/product-formats` returns an array:

```json
[
  { "formatCode": "WHOLE", "formatName": "Whole", "active": true },
  { "formatCode": "CUT", "formatName": "Cut", "active": true },
  { "formatCode": "JUICE", "formatName": "Juice", "active": true },
  { "formatCode": "FREEZEDRIED", "formatName": "Freeze Dried", "active": true }
]
```

`POST /api/v1/product-formats` body:

```json
{
  "formatCode": "FREEZEDRIED",
  "formatName": "Freeze Dried",
  "active": true
}
```

`PUT /api/v1/product-formats/{formatCode}` body is identical to POST.

### Notes

- `formatCode` is stored in uppercase. The backend normalizes case on create/update.
- `formatCode` is unique (case-insensitive).
- When listing formats, always default to `?active=true` for user-facing selection lists.

## Required frontend changes

### 1. Remove hard-coded format enum/options

Search for and replace any hard-coded product format lists such as:

```javascript
const FORMATS = ['WHOLE', 'CUT', 'JUICE'];
```

or

```javascript
const FORMAT_OPTIONS = [
  { value: 'WHOLE', label: 'Whole' },
  { value: 'CUT', label: 'Cut' },
  { value: 'JUICE', label: 'Juice' },
];
```

### 2. Fetch formats from the API

Add a service/hook to load formats from the backend:

```javascript
export async function fetchProductFormats(active = true) {
  const response = await apiClient.get('/product-formats', {
    params: { active },
  });
  return response.data; // array of { formatCode, formatName, active }
}
```

Use this data to populate:

- SKU creation/edit form format dropdown
- Product/SKU filter dropdowns
- Catalog display labels

### 3. Use `formatName` for display, `formatCode` for values

```javascript
// Selection options
const formatOptions = formats.map((f) => ({
  value: f.formatCode,
  label: f.formatName,
}));

// Display in tables/cards
function formatDisplayName(formatCode) {
  return formats.find((f) => f.formatCode === formatCode)?.formatName ?? formatCode;
}
```

Do not add fallback display labels. Use the value returned from the API exactly.

### 4. Update type definitions

If TypeScript is used, replace any enum type such as:

```typescript
enum ProductFormat {
  WHOLE = 'WHOLE',
  CUT = 'CUT',
  JUICE = 'JUICE',
}
```

with:

```typescript
type ProductFormat = string;

interface ProductFormatDto {
  formatCode: string;
  formatName: string;
  active: boolean;
}
```

### 5. Update SKU/product DTO usage

`SkuRequest`, `SkuResponse`, `ProductRequest`, and `CatalogProductResponse` now use `string` for `format` instead of an enum. No other shape changes are required.

### 6. Update OpenAPI-generated client (if applicable)

If the frontend uses an OpenAPI-generated client, regenerate it from `docs/openapi/fnf-v1.yaml`. The `ProductFormat` schema is now a string (`maxLength: 12`) rather than an enum, and new schemas `ProductFormatRequest` and `ProductFormatResponse` are available.

### 7. Add product format management UI (optional)

For admin users, add a new screen using the same patterns as the UOM management screen:

- `GET /api/v1/product-formats` to list formats
- `POST /api/v1/product-formats` to add a format
- `PUT /api/v1/product-formats/{formatCode}` to edit name/active status

## Files to review

Look for hard-coded format references in:

- SKU add/edit forms
- Product/SKU filters and search
- Catalog listing pages
- Label/preview components that render format names
- Constants/i18n files containing "WHOLE", "CUT", "JUICE"
- Any TypeScript enums or JavaScript constants named `ProductFormat`, `Format`, or similar

## Migration checklist

- [ ] Remove hard-coded product format enum/options
- [ ] Add API call to `GET /api/v1/product-formats`
- [ ] Populate format dropdowns from API response
- [ ] Use `formatName` for display labels
- [ ] Update TypeScript types
- [ ] Regenerate OpenAPI client if used
- [ ] Add admin product format management screen (optional)
- [ ] Verify SKU create/update still works with format codes returned by the API
- [ ] Verify product catalog and label views render `formatName` correctly

## Example: React + MUI dropdown

```jsx
import { useEffect, useState } from 'react';
import { TextField, MenuItem } from '@mui/material';
import { fetchProductFormats } from '../api/catalogApi';

function FormatSelect({ value, onChange }) {
  const [formats, setFormats] = useState([]);

  useEffect(() => {
    fetchProductFormats().then(setFormats);
  }, []);

  return (
    <TextField
      select
      label="Format"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
    >
      {formats.map((f) => (
        <MenuItem key={f.formatCode} value={f.formatCode}>
          {f.formatName}
        </MenuItem>
      ))}
    </TextField>
  );
}
```

## Questions?

Contact the backend owner if a format code is missing or if display labels need to change. Format codes and names are now data, not code.
