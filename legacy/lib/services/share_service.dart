import 'package:flutter/services.dart';
import 'package:share_plus/share_plus.dart';

import '../models/quote.dart';

/// Wraps the system share sheet so callers can pass a `Quote` and we
/// format it consistently. Falls back to the clipboard if sharing isn't
/// available (e.g. some web browsers without the Web Share API).
class ShareService {
  const ShareService();

  String _format(Quote quote) {
    return '${quote.text}\n\n${quote.affirmation}\n\n— from Happy Talk';
  }

  /// Returns true if the share sheet was opened, false if we fell back
  /// to the clipboard.
  Future<bool> share(Quote quote, {Rect? sharePositionOrigin}) async {
    final body = _format(quote);
    try {
      final result = await Share.share(
        body,
        subject: 'A small reminder',
        sharePositionOrigin: sharePositionOrigin,
      );
      return result.status == ShareResultStatus.success ||
          result.status == ShareResultStatus.dismissed;
    } catch (_) {
      await Clipboard.setData(ClipboardData(text: body));
      return false;
    }
  }
}
