import 'package:shared_preferences/shared_preferences.dart';

import '../models/personality.dart';

class StorageService {
  StorageService._();
  static final StorageService instance = StorageService._();

  static const _kPersonalityKey = 'happy_talk.personality';
  static const _kFavoritesKey = 'happy_talk.favorites';
  static const _kOnboardedKey = 'happy_talk.onboarded';

  SharedPreferences? _prefs;

  Future<SharedPreferences> _ensure() async {
    return _prefs ??= await SharedPreferences.getInstance();
  }

  Future<PersonalityType?> readPersonality() async {
    final prefs = await _ensure();
    final raw = prefs.getString(_kPersonalityKey);
    if (raw == null) return null;
    for (final type in PersonalityType.values) {
      if (type.name == raw) return type;
    }
    return null;
  }

  Future<void> writePersonality(PersonalityType type) async {
    final prefs = await _ensure();
    await prefs.setString(_kPersonalityKey, type.name);
  }

  Future<bool> isOnboarded() async {
    final prefs = await _ensure();
    return prefs.getBool(_kOnboardedKey) ?? false;
  }

  Future<void> setOnboarded(bool value) async {
    final prefs = await _ensure();
    await prefs.setBool(_kOnboardedKey, value);
  }

  Future<List<String>> readFavorites() async {
    final prefs = await _ensure();
    return prefs.getStringList(_kFavoritesKey) ?? const [];
  }

  Future<void> writeFavorites(List<String> favorites) async {
    final prefs = await _ensure();
    await prefs.setStringList(_kFavoritesKey, favorites);
  }

  Future<void> reset() async {
    final prefs = await _ensure();
    await prefs.remove(_kPersonalityKey);
    await prefs.remove(_kFavoritesKey);
    await prefs.remove(_kOnboardedKey);
  }
}
