import 'package:flutter/material.dart';

import '../services/storage_service.dart';
import '../widgets/app_logo.dart';
import '../widgets/gradient_background.dart';
import 'home_screen.dart';
import 'welcome_screen.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _fade;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    )..forward();
    _fade = CurvedAnimation(parent: _controller, curve: Curves.easeOut);
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    final storage = StorageService.instance;
    final personality = await storage.readPersonality();
    final onboarded = await storage.isOnboarded();
    await Future<void>.delayed(const Duration(milliseconds: 1100));
    if (!mounted) return;

    final next = (personality != null && onboarded)
        ? _route(HomeScreen(personality: personality))
        : _route(const WelcomeScreen());
    Navigator.of(context).pushReplacement(next);
  }

  PageRouteBuilder _route(Widget child) {
    return PageRouteBuilder(
      transitionDuration: const Duration(milliseconds: 500),
      pageBuilder: (_, __, ___) => child,
      transitionsBuilder: (_, anim, __, page) =>
          FadeTransition(opacity: anim, child: page),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: GradientBackground(
        child: Center(
          child: FadeTransition(
            opacity: _fade,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const AppLogo(size: 120),
                const SizedBox(height: 24),
                Text(
                  'happy talk',
                  style: Theme.of(context).textTheme.displayMedium,
                ),
                const SizedBox(height: 8),
                Text(
                  'a softer way to talk to yourself',
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// Re-exported here so other screens can construct the same kind of route.
PageRoute fadeRoute(Widget child, {Duration duration = const Duration(milliseconds: 450)}) {
  return PageRouteBuilder(
    transitionDuration: duration,
    pageBuilder: (_, __, ___) => child,
    transitionsBuilder: (_, anim, __, page) =>
        FadeTransition(opacity: anim, child: page),
  );
}

