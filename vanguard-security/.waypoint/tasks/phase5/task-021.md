# Task 021: Mobile Application Testing Agent

**Phase**: Phase 5
**Wave**: Wave 1 — parallel with web vuln agents (different surface)
**Depends on**: Phase 4 complete
**Labels**: phase5, agent, mobile

## Why This Matters

Mobile apps are full of vulnerabilities that web scanners never see:
- Hardcoded API keys in compiled APK binaries
- Exported Android activities that bypass authentication
- iOS apps that store credentials in plaintext in the Keychain
- Certificate pinning that can be bypassed to intercept all traffic
- Deep links that trigger sensitive actions without authentication

A company might have flawless web security but ship an Android APK with their
production AWS key in strings.xml. `mobile-vuln` catches this.

## What to Build

### Agent: `mobile-vuln`

**Agent definition**:
```typescript
'mobile-vuln': {
  prerequisites: ['recon'],
  promptTemplate: 'mobile-vuln',
  deliverableFilename: 'mobile_vuln_deliverable.md',
  modelTier: 'large',
  required_mode: 'validated',
},
```

**Prompt file**: `apps/worker/prompts/mobile-vuln.txt`

---

### Engagement.yaml Gate

Mobile testing only runs when explicitly enabled:
```yaml
# engagement.yaml
mobile_testing: true
mobile_targets:
  android:
    apk_path: ./target.apk
    package_name: com.targetcorp.app
  ios:
    ipa_path: ./target.ipa
    bundle_id: com.targetcorp.app
```

```typescript
// workflows.ts
if (!engagementConfig.mobile_testing) {
  log.info('mobile-vuln: mobile_testing not enabled — skipping');
  return skipResult();
}
```

---

### Android Testing

**Static Analysis (APK)**:
```
1. Decompile: jadx -d output/ target.apk
2. Manifest analysis (AndroidManifest.xml):
   - exported="true" activities/services/receivers (intent hijacking)
   - android:debuggable="true" (critical)
   - android:allowBackup="true" (data extraction)
   - usesCleartextTraffic="true" (unencrypted HTTP allowed)
   - Network security config override
3. String search across all .java files:
   - AWS key pattern: AKIA[0-9A-Z]{16}
   - Firebase URL: .*firebaseio.com
   - Hardcoded IPs: \b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b
   - JWT secrets: ['"]secret['"]
   - API base URLs (find all endpoints)
4. Dependency scan: check gradle dependencies for known CVEs
5. Deep link enumeration: extract all <intent-filter> with ACTION_VIEW + data scheme
```

**Deep Link Testing (if Android device/emulator available)**:
```
adb shell am start -a android.intent.action.VIEW -d '<deep_link_uri>'
→ Test if deep links bypass authentication
→ Test parameter injection in deep link URIs
→ Test if exported activities expose sensitive data
```

---

### iOS Testing

**Static Analysis (IPA)**:
```
1. Extract IPA: unzip target.ipa → Payload/TargetApp.app
2. Info.plist analysis:
   - NSAppTransportSecurity → ATS exceptions (HTTP allowed?)
   - URL schemes (deep link attack surface)
   - Entitlements (keychain sharing, app groups)
3. Binary analysis with class-dump:
   class-dump -H TargetApp -o headers/
   → Find API client classes, auth classes, crypto usage
4. String extraction:
   strings TargetApp | grep -E "(api_key|secret|password|token|https?://)"
5. Keychain analysis:
   → Look for kSecAttrAccessibleAlways (bad)
   → Look for kSecAttrAccessibleWhenUnlocked (good — check implementation)
6. Plist files scan: search *.plist for hardcoded values
```

**Runtime Analysis (Frida, if device available)**:
```
# Certificate pinning bypass
frida-ios-dump (extract IPA from jailbroken device)
objection -g com.targetcorp.app explore
android sslpinning disable / ios sslpinning disable

# Intercept with Burp after bypass
→ Capture mobile-specific API endpoints
→ Test these endpoints with web vuln agents
```

---

### Findings Routing

Mobile-specific endpoints found → feed back to web vuln pipeline:
```typescript
// Mobile agent writes additional endpoints to recon deliverable
if (mobileDeliverable.api_endpoints.length > 0) {
  await brainPlanner.expandScope(mobileDeliverable.api_endpoints);
}

// Hardcoded credentials → CredentialStore
if (mobileDeliverable.hardcoded_credentials.length > 0) {
  for (const cred of mobileDeliverable.hardcoded_credentials) {
    credentialStore.add({ ...cred, source_agent: 'mobile-vuln' });
  }
}
```

## Files to Create/Change

- `apps/worker/prompts/mobile-vuln.txt` — NEW
- `apps/worker/src/session-manager.ts` — add agent definition
- `apps/worker/src/types/agents.ts` — add to ALL_AGENTS
- `apps/worker/src/temporal/activities.ts` — add activity wrapper
- `apps/worker/src/temporal/workflows.ts` — add to Wave 1, gated by mobile_testing flag
- `apps/worker/src/types/engagement.ts` — add `mobile_testing`, `mobile_targets` fields

## Acceptance Criteria

- [ ] Skips gracefully if `mobile_testing: false` in engagement.yaml
- [ ] Detects hardcoded AWS key in APK strings.xml
- [ ] Detects `android:debuggable="true"` in manifest
- [ ] Detects exported activities in Android manifest
- [ ] iOS: detects ATS exceptions (cleartext HTTP allowed)
- [ ] Hardcoded credentials written to CredentialStore
- [ ] Mobile-specific API endpoints fed back to web vuln pipeline
- [ ] `pnpm run check` passes

## Notes

- jadx is available in Kali container
- Frida/Objection available in Kali container
- Device/emulator is NOT required for static analysis (APK only)
- Runtime analysis (deep links, Frida) only if device path provided in engagement.yaml
- Most high-value findings come from static analysis — prioritize that
- APK and IPA paths must be accessible from within the container (volume mount)
