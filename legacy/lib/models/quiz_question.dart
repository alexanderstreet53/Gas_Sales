import 'personality.dart';

class QuizOption {
  const QuizOption({required this.label, required this.type});

  final String label;
  final PersonalityType type;
}

class QuizQuestion {
  const QuizQuestion({required this.prompt, required this.options});

  final String prompt;
  final List<QuizOption> options;
}
