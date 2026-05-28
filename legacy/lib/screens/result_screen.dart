import 'package:flutter/material.dart';

import '../models/personality.dart';
import '../theme/app_theme.dart';
import '../widgets/gradient_background.dart';
import '../widgets/primary_button.dart';
import 'home_screen.dart';
import 'splash_screen.dart';

class ResultScreen extends StatefulWidget {
  const ResultScreen({super.key, required this.personality});

  final PersonalityType personality;

  @override
  State<ResultScreen> createState() => _ResultScreenState();
}

class _ResultScreenState extends State<ResultScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _scale;
  late final Animation<double> _fade;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    );
    _scale = CurvedAnimation(
      parent: _controller,
      curve: const Interval(0, 0.6, curve: Curves.easeOutBack),
    );
    _fade = CurvedAnimation(
      parent: _controller,
      curve: const Interval(0.4, 1, curve: Curves.easeOut),
    );
    _controller.forward();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final personality = personalityFor(widget.personality);
    final text = Theme.of(context).textTheme;

    return Scaffold(
      body: GradientBackground(
        colors: personality.gradient,
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(28, 24, 28, 32),
            child: Column(
              children: [
                Align(
                  alignment: Alignment.centerLeft,
                  child: Text(
                    'your match',
                    style: text.bodyMedium?.copyWith(
                      letterSpacing: 1.6,
                      color: AppPalette.ink.withOpacity(0.55),
                    ),
                  ),
                ),
                const Spacer(flex: 1),
                ScaleTransition(
                  scale: _scale,
                  child: Text(
                    personality.emoji,
                    style: const TextStyle(fontSize: 96),
                  ),
                ),
                const SizedBox(height: 16),
                FadeTransition(
                  opacity: _fade,
                  child: Column(
                    children: [
                      Text(personality.title, style: text.displayMedium),
                      const SizedBox(height: 8),
                      Text(
                        personality.tagline,
                        style: text.bodyLarge?.copyWith(
                            color: AppPalette.ink.withOpacity(0.7),
                            fontStyle: FontStyle.italic),
                      ),
                      const SizedBox(height: 28),
                      Container(
                        padding: const EdgeInsets.all(20),
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.55),
                          borderRadius: BorderRadius.circular(24),
                        ),
                        child: Text(
                          personality.description,
                          style: text.bodyLarge,
                          textAlign: TextAlign.left,
                        ),
                      ),
                    ],
                  ),
                ),
                const Spacer(flex: 2),
                FadeTransition(
                  opacity: _fade,
                  child: PrimaryButton(
                    label: 'Read my first thought',
                    icon: Icons.arrow_forward_rounded,
                    onPressed: () {
                      Navigator.of(context).pushReplacement(
                        fadeRoute(HomeScreen(personality: widget.personality)),
                      );
                    },
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
