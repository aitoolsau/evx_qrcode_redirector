# 🔒 AUTHENTICATION CODE FREEZE

**EFFECTIVE IMMEDIATELY - September 2, 2025**

## 🚫 FROZEN FILES - DO NOT MODIFY

The following files are under **STRICT CODE FREEZE** for authentication stability:

### Core Authentication Files:
- `src/routes/auth.ts` - Login/logout handlers, session validation
- `src/services/auth.ts` - Password verification, session management, validation functions
- `src/services/kv.ts` - Session versioning, config storage (auth-related functions only)

### Crypto & Security:
- `src/lib/crypto.ts` - HMAC signing/verification, password hashing
- `src/lib/base64.ts` - Base64 encoding/decoding for tokens

### Authentication-Related Functions in Other Files:
- `src/worker.ts` - Authentication middleware and route protection
- `src/routes/admin.ts` - Login form, checkAuth function, authentication UI
- `src/routes/mappings.ts` - Authentication guards for API endpoints

## ✅ ALLOWED MODIFICATIONS

The following areas are SAFE for modifications:
- UI styling (non-auth related CSS)
- Data display logic in admin interface
- Export/import functionality (business logic only)
- Pagination implementation
- Health check endpoints
- Non-authenticated routes

## 🔐 AUTHENTICATION FUNCTIONS TO AVOID

DO NOT modify these functions or their logic:
- `verifyPassword()`
- `issueSession()`
- `validateSession()`
- `requireAuth()`
- `handleLoginForm()`
- `handleApiMe()`
- `checkAuth()` (client-side)
- Session cookie handling
- HMAC signing/verification
- Password hashing

## 📋 CURRENT STABLE STATE

Authentication system is currently working with:
- Form-based login at `/urlmapping`
- Session cookies with HMAC signatures
- Password verification with KV fallback
- Session versioning for security
- Proper logout functionality

## ⚠️ VIOLATION CONSEQUENCES

Any modifications to frozen authentication code will:
1. Require immediate rollback
2. Force redeployment to stable state
3. Potentially lock out admin access

**Last Known Good State**: Commit `2dcafb8` - feat(pagination): implement pagination for mappings

---
*This freeze remains in effect until explicitly lifted by the user.*
