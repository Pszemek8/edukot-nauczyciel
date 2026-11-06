# Naprawa PIN-u nauczyciela

PIN blokady aplikacji jest teraz zapisywany osobno w localStorage pod kluczem `edukot-teacher-pin-hash`. Nie jest już nadpisywany przez synchronizację danych dziennika ani mylony z PIN-em przypisanym do starego kodu synchronizacji.

- Domyślny PIN aplikacji: `0000`.
- Zmiana PIN-u w Ustawieniach zapisuje go na tym urządzeniu.
- Dane dziennika i PIN starej synchronizacji pozostają osobnymi elementami.
- Po wdrożeniu odśwież aplikację twardo: Ctrl+F5. Jeśli działa jako PWA, zamknij ją i otwórz ponownie.

Uwaga: PIN aplikacji jest lokalny dla przeglądarki/urządzenia. Na innym urządzeniu trzeba ustawić własny PIN blokady; PIN starego kodu synchronizacji nadal jest niezależny.
