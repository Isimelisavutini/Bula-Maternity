# Care-pod demonstration workflow

The web demonstration now includes the patient “Ask My Midwife” screen and a shared staff care-pod workspace. It runs on the current demo API and the C# API, with shared synthetic roster/assignment defaults in `shared/care-pod.json`. It is separate from the Supabase production patient portal and native iOS patient data plane.

## Try the workflow

- Sign in as Patient (`patient` / `bula-patient`). The home card introduces the assigned midwife, clinic days, and on-duty cover. “Ask a question” opens a safety check before the composer.
- Select a warning symptom to see direct-contact guidance and explicitly record an alert. No regular question is created on this branch. Calls require a verified `NEXT_PUBLIC_MATERNITY_TRIAGE_PHONE`; the app never supplies an invented number. Maps opens directions only when tapped and never silently collects location.
- Choose “None of these” for a routine question, select a category, and send text and/or a voice note. A 30-second recording starts only after a microphone action and browser permission. It can be previewed or discarded before sending. Clinical context uses the patient record's gestation, not the dashboard simulator.
- Sign in as Sister Mere (`midwife` / `bula-midwife`). Midwife login opens the shared queue. Find it again under **Patient Messages** in the side menu, or **Messages** in the mobile bottom navigation; its badge counts open conversations, not unread messages. Select a patient to read and reply; the conversation is brought into view. Set “In Delivery” to route unanswered work to Sister Kesa (`kesa` / `bula-kesa`). Sister Litia (`litia` / `bula-litia`) is the third pod member. If nobody is on duty, work remains visibly unassigned; availability is never invented.
- Reply using text, a voice note, or a draft macro. An appointment request creates a Pending entry in the existing appointment list and adds a conversation message. A mother can continue a conversation after another safety check. Closed threads reject additional messages.
- Staff can assign a booking patient to a primary midwife within the Suva pod. The prototype has one zone/pod; it does not claim to perform clinical risk or workload optimization.
- Urgent alerts appear separately and can be acknowledged. Acknowledgement records review, not successful contact, assessment, or resolution. Accepted and rejected mutations enter the existing audit trail.

## Behavior and limits

### Built-in chat and privacy consent

CareFiji chat uses its own patient/care-team conversation bubbles, sender names, device-local timestamps, scrollable history and voice-note playback. It does not integrate an external messenger. Patient messages align to the sender's side; staff see care-team replies on their own side. A saved message is not a delivered/read receipt. History remains readable without consenting to another send.

Before each patient message or follow-up, an unchecked-by-default privacy checkbox explains the demo's recipients, stored information, optional device drafts, recording permissions and non-emergency limitations. Declining keeps sending and recording unavailable, but does not block urgent contact guidance. Unchecking stops the recorder and discards the unsent recording; previously sent messages remain. The notice explicitly disclaims end-to-end encryption and prohibits real patient information in the demo. Its text/version lives in `shared/chat-privacy.json`, embedded in C# and imported by the web/JavaScript fallback.

Both APIs reject missing, false, non-boolean or outdated consent, even when called outside the UI. Each accepted patient message stores the notice version, authenticated demo user ID and server acceptance timestamp alongside its existing audit event. Historical messages are not retroactively marked as consented. This is demonstration acknowledgement evidence, not production consent governance or a retention/deletion service. Changing a checkbox does not revoke an in-flight submission; acceptance records the explicit send action. Existing clients must send `privacyConsent: true` and the current `privacyVersion` for patient chat actions. Bump the notice version whenever its meaning or wording changes. Urgent alerts remain a separate explicit action with a symptom-sharing disclosure; direct emergency contact guidance is always available without sending an alert or agreeing to chat.

The shared queue refreshes every 15 seconds while the web page is visible, plus on connectivity recovery and foreground return. Refreshing reads data only. Draft text can be saved on the device, but submitting or recording an alert needs connectivity. Offline draft text is not automatically sent; voice drafts are not saved across reloads. Request failures preserve the current draft and recording.

The welcome uses device speech synthesis when available, explicitly labeled as a device-read welcome. Profiles and portraits are synthetic, not real clinical credentials. Text accepts English, iTaukei, and Hindi; no automated translation, transcription, or language-specific clinical interpretation is provided.

Category targets reproduce the proposed operational estimates: movement questions 45 minutes, pain/cramps and discharge 4 hours, emotional support 2 hours, and general/food/vitamin questions 6 hours. They are demo targets, not guaranteed staffed-service SLAs. Reduced/stopped movements, bleeding/fluid leakage, severe headache/vision symptoms, severe pain, and immediate mental-health safety concerns are routed to direct-contact guidance. The prototype does not recommend waiting for a timed kick count or a chat reply before seeking maternity advice.

Macros and topic guidance are drafts for clinical review; the interface does not represent them as approved clinical protocols. There is no diagnosis engine. The emergency screen is always available, including when offline or when alert submission fails.

For the synthetic demo only, audio is a bounded inline attachment (approximately 250 KB per recording, supported audio MIME types only), with maximum 100 threads, 50 messages per thread, and a bounded aggregate care-pod document. It is not a production health-record storage design. Both demo backends use atomic compare-and-set Redis mutations so concurrent patient/staff changes do not overwrite each other.

## Production follow-through

Before this workflow is connected to real patient accounts, it needs authenticated clinical staff identity and pod-scoped authorization; dedicated Supabase tables/RLS and private audio storage; approved clinical content and emergency contacts; a real staffed roster and escalation/notification provider; retention and consent decisions; and native iOS chat/outbox support. No production migration, push/SMS dispatch, real midwife availability, or external notification has been provisioned by this change. The current Azure/Supabase credential blockers still apply.

## Verification

Node and xUnit tests cover permission boundaries, patient scoping, server-stamped gestation, safety confirmation, duty handover, no-cover routing, replies/follow-ups, booking, closure, alerts, attachment restrictions, and audit behavior. The same API contract workflow runs against C# directly and through the Next.js rewrite in CI. Browser checks cover the patient-to-midwife-to-patient interaction and mobile layouts. Production clinical operation is not inferred from synthetic test success.
