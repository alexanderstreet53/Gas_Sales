import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppPalette {
  static const cream = Color(0xFFFFF8F2);
  static const ink = Color(0xFF1F1B2E);
  static const slate = Color(0xFF6B6580);
  static const accent = Color(0xFF7C5CFF);

  static const blush = Color(0xFFFFD9D9);
  static const lavender = Color(0xFFE6DCFF);
  static const sage = Color(0xFFD6E8D2);
  static const peach = Color(0xFFFFD9C2);
  static const sky = Color(0xFFC9E1F0);
  static const whisper = Color(0xFFF6F1FF);
}

class AppGradients {
  static const sunrise = [Color(0xFFFFD9C2), Color(0xFFFFC8B4)];
  static const dusk = [Color(0xFFE6DCFF), Color(0xFFFFD9C2)];
  static const meadow = [Color(0xFFD6E8D2), Color(0xFFC9E1F0)];
  static const ocean = [Color(0xFFC9E1F0), Color(0xFFE6DCFF)];
  static const calm = [
    Color(0xFFFFF8F2),
    Color(0xFFE6DCFF),
    Color(0xFFD6E8D2),
  ];
}

class AppTheme {
  static ThemeData light() {
    final base = ThemeData.light(useMaterial3: true);

    final textTheme = GoogleFonts.plusJakartaSansTextTheme(base.textTheme).copyWith(
      displayLarge: GoogleFonts.fraunces(
        fontSize: 44,
        fontWeight: FontWeight.w600,
        color: AppPalette.ink,
        height: 1.1,
      ),
      displayMedium: GoogleFonts.fraunces(
        fontSize: 36,
        fontWeight: FontWeight.w600,
        color: AppPalette.ink,
        height: 1.15,
      ),
      headlineMedium: GoogleFonts.fraunces(
        fontSize: 28,
        fontWeight: FontWeight.w600,
        color: AppPalette.ink,
        height: 1.2,
      ),
      headlineSmall: GoogleFonts.fraunces(
        fontSize: 22,
        fontWeight: FontWeight.w600,
        color: AppPalette.ink,
      ),
      titleLarge: GoogleFonts.plusJakartaSans(
        fontSize: 18,
        fontWeight: FontWeight.w600,
        color: AppPalette.ink,
      ),
      bodyLarge: GoogleFonts.plusJakartaSans(
        fontSize: 17,
        height: 1.55,
        color: AppPalette.ink,
      ),
      bodyMedium: GoogleFonts.plusJakartaSans(
        fontSize: 16,
        height: 1.5,
        color: AppPalette.slate,
      ),
      labelLarge: GoogleFonts.plusJakartaSans(
        fontSize: 16,
        fontWeight: FontWeight.w600,
        color: AppPalette.cream,
      ),
    );

    return base.copyWith(
      scaffoldBackgroundColor: AppPalette.cream,
      colorScheme: const ColorScheme.light(
        primary: AppPalette.ink,
        onPrimary: AppPalette.cream,
        secondary: AppPalette.accent,
        onSecondary: AppPalette.cream,
        surface: AppPalette.cream,
        onSurface: AppPalette.ink,
      ),
      textTheme: textTheme,
      iconTheme: const IconThemeData(color: AppPalette.ink),
      appBarTheme: const AppBarTheme(
        backgroundColor: Colors.transparent,
        elevation: 0,
        foregroundColor: AppPalette.ink,
        centerTitle: true,
      ),
      splashFactory: NoSplash.splashFactory,
      highlightColor: Colors.transparent,
    );
  }
}
