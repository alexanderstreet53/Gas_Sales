import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../data/quiz_questions.dart';
import '../models/personality.dart';
import '../models/quiz_question.dart';
import '../services/personality_scorer.dart';
import '../services/storage_service.dart';
import '../theme/app_theme.dart';
import '../widgets/gradient_background.dart';
import 'result_screen.dart';
import 'splash_screen.dart';

class QuizScreen extends StatefulWidget {
  const QuizScreen({super.key});

  @override
  State<QuizScreen> createState() => _QuizScreenState();
}

class _QuizScreenState extends State<QuizScreen> {
  final PageController _controller = PageController();
  final List<PersonalityType?> _answers =
      List<PersonalityType?>.filled(kQuizQuestions.length, null);
  int _index = 0;
  int? _selectedFlash;

  void _onSelect(int qIndex, int oIndex, PersonalityType type) {
    HapticFeedback.selectionClick();
    setState(() {
      _selectedFlash = oIndex;
      _answers[qIndex] = type;
    });
    Future.delayed(const Duration(milliseconds: 220), () {
      if (!mounted) return;
      _selectedFlash = null;
      if (qIndex == kQuizQuestions.length - 1) {
        _finish();
      } else {
        _controller.nextPage(
          duration: const Duration(milliseconds: 320),
          curve: Curves.easeOut,
        );
      }
    });
  }

  Future<void> _finish() async {
    final picks = _answers.whereType<PersonalityType>().toList();
    final winner = const PersonalityScorer().score(picks);
    await StorageService.instance.writePersonality(winner);
    await StorageService.instance.setOnboarded(true);
    if (!mounted) return;
    Navigator.of(context).pushReplacement(fadeRoute(ResultScreen(personality: winner)));
  }

  void _onBack() {
    if (_index == 0) {
      Navigator.of(context).maybePop();
      return;
    }
    _controller.previousPage(
      duration: const Duration(milliseconds: 280),
      curve: Curves.easeOut,
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final progress = (_index + 1) / kQuizQuestions.length;

    return Scaffold(
      body: GradientBackground(
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
            child: Column(
              children: [
                Row(
                  children: [
                    IconButton(
                      onPressed: _onBack,
                      icon: const Icon(Icons.arrow_back_rounded),
                      tooltip: 'Back',
                    ),
                    const Spacer(),
                    Text(
                      '${_index + 1} / ${kQuizQuestions.length}',
                      style: text.bodyMedium,
                    ),
                    const SizedBox(width: 8),
                  ],
                ),
                const SizedBox(height: 8),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(6),
                    child: TweenAnimationBuilder<double>(
                      tween: Tween(begin: 0, end: progress),
                      duration: const Duration(milliseconds: 320),
                      curve: Curves.easeOut,
                      builder: (_, value, __) => LinearProgressIndicator(
                        value: value,
                        minHeight: 6,
                        backgroundColor: AppPalette.ink.withOpacity(0.08),
                        valueColor:
                            const AlwaysStoppedAnimation<Color>(AppPalette.ink),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                Expanded(
                  child: PageView.builder(
                    controller: _controller,
                    physics: const NeverScrollableScrollPhysics(),
                    onPageChanged: (i) => setState(() => _index = i),
                    itemCount: kQuizQuestions.length,
                    itemBuilder: (_, i) => _QuestionPage(
                      question: kQuizQuestions[i],
                      onSelect: (oIndex, type) => _onSelect(i, oIndex, type),
                      flashIndex: _index == i ? _selectedFlash : null,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _QuestionPage extends StatelessWidget {
  const _QuestionPage({
    required this.question,
    required this.onSelect,
    required this.flashIndex,
  });

  final QuizQuestion question;
  final void Function(int oIndex, PersonalityType type) onSelect;
  final int? flashIndex;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: 8),
          Text(
            question.prompt,
            style: text.headlineMedium,
          ),
          const SizedBox(height: 28),
          for (var i = 0; i < question.options.length; i++) ...[
            _OptionTile(
              label: question.options[i].label,
              flash: flashIndex == i,
              onTap: () => onSelect(i, question.options[i].type),
            ),
            const SizedBox(height: 12),
          ],
        ],
      ),
    );
  }
}

class _OptionTile extends StatelessWidget {
  const _OptionTile({
    required this.label,
    required this.flash,
    required this.onTap,
  });

  final String label;
  final bool flash;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 220),
      curve: Curves.easeOut,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(22),
        color: flash ? AppPalette.ink : Colors.white.withOpacity(0.6),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0F1F1B2E),
            blurRadius: 16,
            offset: Offset(0, 8),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(22),
        child: InkWell(
          borderRadius: BorderRadius.circular(22),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 18, horizontal: 22),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    label,
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          color: flash ? AppPalette.cream : AppPalette.ink,
                          fontWeight: FontWeight.w500,
                        ),
                  ),
                ),
                Icon(
                  Icons.arrow_forward_rounded,
                  color: flash ? AppPalette.cream : AppPalette.ink.withOpacity(0.45),
                  size: 20,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
