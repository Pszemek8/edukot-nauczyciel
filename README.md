# EduKot 2.0 – Panel nauczyciela

## Wdrożenie
Wgraj cały folder projektu do Vercel (lub użyj Vercel CLI z tego folderu). Nie wrzucaj samego `index.html` — wymagane są też `api/`, `icons/`, `manifest.webmanifest` i `sw.js`.

## Upstash
W Vercel → Settings → Environment Variables ustaw:
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `EDUKOT_TEACHER_PIN` — **wymagane** do kodów rodziców (osobny PIN niż blokada aplikacji)

Następnie wykonaj ponowne wdrożenie.

## PIN aplikacji
Na świeżej instalacji domyślny PIN nauczyciela to `0000`. Zmień go po pierwszym uruchomieniu w Ustawieniach. W istniejącym lokalnym dzienniku zachowany zostaje dotychczasowy PIN i dane.

## Zachowane funkcje starego Kociego Dziennika
- kody synchronizacji i PIN przypisany do kodu,
- synchronizacja z `/api/sync` i Upstash Redis,
- oceny, obecności, tematy, uwagi/pochwały, lista kotków,
- kopia zapasowa JSON i przywracanie,
- jasny i ciemny motyw.

## Dodane opcje
- plan lekcji z dniem i godziną,
- kartkówki i sprawdziany,
- historia ocen,
- branding EduKot 2.0,
- **kody dostępu rodziców** (generowanie, prośby, akceptacja/odrzucenie, lista i wyłączanie kodów).

## Kody rodziców – przepływ
1. Połącz dziennik kodem synchronizacji (Ustawienia).
2. Zakładka **Kody rodziców** → wpisz `EDUKOT_TEACHER_PIN` z Vercel.
3. Wybierz ucznia, opcjonalnie własny kod (np. `KOTEK-4821`) → **Wygeneruj kod**.
4. Przekaż kod rodzicowi (panel rodzica).
5. Rodzic wysyła prośbę → pojawia się w **Oczekujące prośby** → Akceptuj / Odrzuć.
6. Po akceptacji rodzic widzi **tylko** dane przypisanego dziecka (oceny, obecność, uwagi, sprawdziany, plan).

Przycisk **Lista kodów** pozwala podejrzeć i wyłączyć wygenerowane kody.

## Ważne ograniczenia
To jest panel nauczyciela oparty na starym lokalnym dzienniku i jego mechanizmie synchronizacji. Kody synchronizacji nie są systemem kont ani uprawnień rodzic/admin. Nie podłączaj prawdziwych danych dzieci przed audytem bezpieczeństwa i świadomym użyciem `EDUKOT_TEACHER_PIN`.

API rodzica filtruje dane po stronie serwera: rodzic z ważną sesją otrzymuje wyłącznie przypisanego ucznia.

## Własne ikony EduKot
Dodano logo nauczyciela jako favicon, ikonę Apple Touch oraz ikony PWA 192×192 i 512×512, także w wariantach maskable. Zmieniono nazwę cache Service Workera, aby przeglądarka pobrała nowe ikony po wdrożeniu.
Po wdrożeniu zamknij starą aplikację PWA i uruchom ją ponownie. Jeśli ikona na ekranie głównym się nie zmieni, usuń skrót/aplikację i zainstaluj ponownie z przeglądarki.
