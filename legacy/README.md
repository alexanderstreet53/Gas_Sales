# Happy Talk (legacy)

> a softer way to talk to yourself

**Note:** this is the original Flutter app the repository started as. It
was archived here when the project pivoted to a gas tank detection
prospecting platform — see the top-level [`README.md`](../README.md) for
the active project. Nothing in `legacy/` is wired into the new platform.

A Flutter app that gives you motivational prompts tuned to your personality —
calm, specific, kind reminders made to interrupt anxious spirals and
perfectionist loops.

## Quickstart

```bash
flutter create .          # generate platform folders (ios/, android/, etc.)
flutter pub get
flutter run
```

> The repository ships only with the cross-platform `lib/` source. Run
> `flutter create .` once after cloning to scaffold the platform projects.

## Project layout

```
lib/
├── main.dart                      # entrypoint
├── app.dart                       # MaterialApp + theme wiring
├── data/
│   ├── quiz_questions.dart        # 6-question quiz content
│   └── quotes_data.dart           # curated quote library
├── models/
│   ├── personality.dart           # 4 archetypes + metadata
│   ├── quiz_question.dart
│   └── quote.dart
├── screens/
│   ├── splash_screen.dart
│   ├── welcome_screen.dart
│   ├── quiz_screen.dart
│   ├── result_screen.dart
│   ├── home_screen.dart
│   └── favorites_screen.dart
├── services/
│   ├── personality_scorer.dart    # tally → winning type
│   ├── quote_service.dart         # filter + non-repeating shuffle
│   └── storage_service.dart       # shared_preferences wrapper
├── theme/
│   └── app_theme.dart             # palette, typography, gradients
└── widgets/
    ├── gradient_background.dart   # bg + radial blobs
    ├── primary_button.dart        # filled + outlined variants
    └── quote_card.dart            # the main hero card
```

## Principles

- **No spirals.** Quotes invite, never accuse.
- **Specific, not generic.** Quotes filtered by personality.
- **Quiet UI.** Pastel gradients, generous whitespace, no streaks.
- **Private by default.** All data on-device. No accounts, no analytics.

## Stack

| Layer    | Choice                                |
| -------- | ------------------------------------- |
| Framework | Flutter ≥ 3.19 (Dart ≥ 3.3)          |
| Material | Material 3                            |
| Fonts    | `google_fonts` (Fraunces + Plus Jakarta Sans) |
| Storage  | `shared_preferences`                  |
| Share    | `share_plus`                          |
| Widget   | `home_widget` (iOS WidgetKit + Android AppWidget) |
| Lints    | `flutter_lints`                       |

## Features

- **Personality quiz + matched quote feed** — four warm archetypes
- **SOS room** — separate quote pool + breathing pacer for spiraling moments
- **Favorites** — kept thoughts, on-device only
- **Share** — system share sheet, send a thought to friends and family
- **iOS Home Screen widget** — see "iOS widget setup" below
- **Painted brand logo** — `AppLogo` widget, `web/icons/logo.svg`

## iOS widget setup

The Flutter side is wired up via `lib/services/widget_service.dart` and
`lib/widgets/app_logo.dart`, and the Swift extension lives at
`ios/HappyTalkWidget/`. Wiring it into the Xcode project is a one-time
manual step:

1. Run `flutter create .` to generate the `ios/` Xcode project.
2. Open `ios/Runner.xcworkspace` in Xcode.
3. **File → New → Target → Widget Extension**, name it `HappyTalkWidget`.
   Untick "Include Configuration App Intent". Activate the scheme when prompted.
4. Replace the auto-generated files with the ones already in
   `ios/HappyTalkWidget/`:
   - `HappyTalkWidget.swift`
   - `Info.plist`
   - `HappyTalkWidget.entitlements`
5. **Signing & Capabilities** → add **App Groups** to *both* the Runner
   target and the HappyTalkWidget target. Use the identifier
   `group.com.happytalk.shared` (must match `WidgetService.appGroupId`).
6. Build & run on a device or simulator. Long-press the home screen,
   tap **+**, search "Happy Talk" and add the widget.

Android: a parallel widget provider can be added under `android/`. Not
shipped in this repo yet — `home_widget` will silently no-op until then.
