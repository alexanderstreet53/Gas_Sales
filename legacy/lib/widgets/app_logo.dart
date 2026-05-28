import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// Brand mark for Happy Talk.
///
/// Soft pastel disc with a crescent inside (the calm) and a sparkle near
/// the top-right (the moment of softness). Painted, so it scales perfectly
/// at any size with no asset weight.
class AppLogo extends StatelessWidget {
  const AppLogo({super.key, this.size = 96, this.showShadow = true});

  final double size;
  final bool showShadow;

  @override
  Widget build(BuildContext context) {
    final disc = SizedBox.square(
      dimension: size,
      child: CustomPaint(painter: _LogoPainter()),
    );

    if (!showShadow) return disc;
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        boxShadow: [
          BoxShadow(
            color: AppPalette.ink.withOpacity(0.10),
            blurRadius: 24,
            offset: const Offset(0, 14),
          ),
        ],
      ),
      child: disc,
    );
  }
}

class _LogoPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    // Draw in a 96x96 design space, scale to the requested size.
    canvas.save();
    canvas.scale(size.width / 96.0);

    const center = Offset(48, 48);

    // Outer pastel disc.
    canvas.drawCircle(
      center,
      46,
      Paint()
        ..shader = const RadialGradient(
          center: Alignment(-0.24, -0.28),
          radius: 0.95,
          colors: [
            Color(0xFFFFF1FA),
            Color(0xFFE6DCFF),
            Color(0xFFD6E8D2),
          ],
          stops: [0.0, 0.55, 1.0],
        ).createShader(const Rect.fromLTWH(0, 0, 96, 96)),
    );

    // Inner highlight ring for the soft glass feel.
    canvas.drawCircle(
      center,
      45,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.2
        ..color = Colors.white.withOpacity(0.45),
    );

    // Soft smile — single quadratic curve, dark ink, rounded caps.
    final smile = Path()
      ..moveTo(28, 50)
      ..quadraticBezierTo(48, 74, 68, 50);
    canvas.drawPath(
      smile,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 6
        ..strokeCap = StrokeCap.round
        ..color = AppPalette.ink.withOpacity(0.92),
    );

    // Sparkle, top-right area of the disc.
    final sparkle = Path()
      ..moveTo(74, 22)
      ..lineTo(76, 28)
      ..lineTo(82, 30)
      ..lineTo(76, 32)
      ..lineTo(74, 38)
      ..lineTo(72, 32)
      ..lineTo(66, 30)
      ..lineTo(72, 28)
      ..close();
    canvas.drawPath(sparkle, Paint()..color = AppPalette.accent);

    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant _LogoPainter oldDelegate) => false;
}
