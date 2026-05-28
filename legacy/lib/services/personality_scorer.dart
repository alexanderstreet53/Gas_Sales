import '../models/personality.dart';

class PersonalityScorer {
  const PersonalityScorer();

  PersonalityType score(List<PersonalityType> answers) {
    final tally = <PersonalityType, int>{
      for (final type in PersonalityType.values) type: 0,
    };
    for (final pick in answers) {
      tally[pick] = (tally[pick] ?? 0) + 1;
    }

    PersonalityType winner = PersonalityType.values.first;
    int best = -1;
    for (final type in PersonalityType.values) {
      final count = tally[type] ?? 0;
      if (count > best) {
        best = count;
        winner = type;
      }
    }
    return winner;
  }
}
