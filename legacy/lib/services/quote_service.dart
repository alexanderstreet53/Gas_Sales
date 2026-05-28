import 'dart:math';

import '../data/quotes_data.dart';
import '../models/personality.dart';
import '../models/quote.dart';

class QuoteService {
  QuoteService({Random? random}) : _random = random ?? Random();

  final Random _random;

  List<Quote> forPersonality(PersonalityType type) {
    return kQuotes.where((q) => q.matches(type)).toList(growable: false);
  }

  List<Quote> shuffledFeed(PersonalityType type, {int? seed}) {
    final pool = forPersonality(type).toList();
    final rng = seed != null ? Random(seed) : _random;
    pool.shuffle(rng);
    return pool;
  }

  Quote? findByText(String text) {
    for (final q in kQuotes) {
      if (q.text == text) return q;
    }
    return null;
  }
}
