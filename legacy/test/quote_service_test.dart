import 'package:flutter_test/flutter_test.dart';

import 'package:happy_talk/data/quotes_data.dart';
import 'package:happy_talk/models/personality.dart';
import 'package:happy_talk/services/quote_service.dart';

void main() {
  final service = QuoteService();

  test('every personality has at least the universal quotes', () {
    final universal = kQuotes.where((q) => q.isUniversal()).length;
    for (final type in PersonalityType.values) {
      final feed = service.forPersonality(type);
      expect(feed.length, greaterThanOrEqualTo(universal));
    }
  });

  test('shuffled feed contains exactly the matching quotes', () {
    for (final type in PersonalityType.values) {
      final filtered = service.forPersonality(type);
      final shuffled = service.shuffledFeed(type, seed: 1);
      expect(shuffled.length, filtered.length);
      expect(shuffled.toSet(), filtered.toSet());
    }
  });

  test('findByText matches an existing quote', () {
    final any = kQuotes.first;
    expect(service.findByText(any.text)?.affirmation, any.affirmation);
    expect(service.findByText('not a real quote'), isNull);
  });
}
