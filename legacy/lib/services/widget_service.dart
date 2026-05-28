import 'dart:io' show Platform;

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:home_widget/home_widget.dart';

import '../models/quote.dart';

/// Pushes the current quote into the iOS App Group / Android shared prefs
/// so the native Home Screen widget can render it.
///
/// On any platform without a configured native widget (web, desktop, or
/// before the Xcode/Gradle setup is done) the calls quietly no-op, so
/// this is safe to call from anywhere.
class WidgetService {
  static const String appGroupId = 'group.com.happytalk.shared';
  static const String iosWidgetName = 'HappyTalkWidget';
  static const String androidWidgetProvider = 'HappyTalkWidgetProvider';

  static const String _kQuoteText = 'happy_talk_quote_text';
  static const String _kAffirmation = 'happy_talk_affirmation';

  static bool _initialized = false;

  static bool get _isMobile {
    if (kIsWeb) return false;
    try {
      return Platform.isIOS || Platform.isAndroid;
    } catch (_) {
      return false;
    }
  }

  static Future<void> _ensureInit() async {
    if (_initialized || !_isMobile) return;
    try {
      await HomeWidget.setAppGroupId(appGroupId);
      _initialized = true;
    } catch (_) {
      // Plugin missing, simulator without app group, etc. — silently ignore.
    }
  }

  /// Push a quote to the home screen widget. Safe to call repeatedly;
  /// repeats with the same content are cheap.
  static Future<void> push(Quote quote) async {
    if (!_isMobile) return;
    await _ensureInit();
    try {
      await HomeWidget.saveWidgetData<String>(_kQuoteText, quote.text);
      await HomeWidget.saveWidgetData<String>(_kAffirmation, quote.affirmation);
      await HomeWidget.updateWidget(
        name: androidWidgetProvider,
        iOSName: iosWidgetName,
      );
    } catch (_) {
      // Widget extension not set up yet — that's fine.
    }
  }
}
