import 'personality.dart';

class Quote {
  const Quote({
    required this.text,
    required this.affirmation,
    this.types = const {},
  });

  final String text;
  final String affirmation;
  final Set<PersonalityType> types;

  bool isUniversal() => types.isEmpty;

  bool matches(PersonalityType type) => types.isEmpty || types.contains(type);
}
