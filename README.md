# BOARD · Roadmap & Forecast

Dashboard dark/gold do planowania wielu inicjatyw i zespołów. Samodzielny `index.html`
z zakładkami **Roadmapa**, **Inicjatywy** oraz **Zespoły i capacity**; bez zależności
frontendowych i bez serwera aplikacyjnego. Repozytorium początkowo nie zawierało
aplikacji board1 ani pliku `index.html`, dlatego dodano nową stronę.

## Użytkowanie

1. W **Zespoły i capacity** dodaj/usuń kompetencje (domyślnie `.net`, `mobile`,
   `frontend`, `altamirka`), nazwij zespoły i zaznacz ich kompetencje.
2. Uzupełnij capacity każdej kompetencji zespołu w kalendarzu: bieżący miesiąc
   i 11 kolejnych. Jednostką są **dni pracy na miesiąc**, np. 40 dni odpowiada
   w przybliżeniu dwóm osobom. Zero oznacza brak dostępności. **Klonuj →**
   kopiuje wszystkie kompetencje wybranego miesiąca zespołu do kolejnych miesięcy.
3. W **Inicjatywy** dodaj co najmniej dwie inicjatywy, zaznacz wymagane kompetencje,
   podaj datę startu i opcjonalny termin **fixed date**.
4. Dodaj elementy pracy. Każdy element ma nazwę, zespół, jedną kompetencję, estymatę
   min/max **dni pracy** oraz opcjonalny start i fixed date. Dla każdej kompetencji
   inicjatywy wymagany jest co najmniej jeden element. Pracę wymagającą kilku
   kompetencji rozbij na osobne elementy. Strzałki określają priorytet inicjatyw
   i kolejność elementów.
5. Kliknij **Przelicz prognozę**. Roadmapa pokazuje Gantt, daty P85, szansę dotrzymania
   terminów i odsetek ukończonych scenariuszy w rocznym horyzoncie.

Dane przykładowe pomagają rozpocząć pracę. Zmiany są zapisywane w `localStorage`
tej przeglądarki, bez wysyłania danych na serwer i bez współdzielenia między
użytkownikami. Prognoza jest unieważniana po zmianach; należy ją przeliczyć ponownie.
Przycisk przywrócenia przykładów wymaga potwierdzenia i zastępuje lokalne dane.

### Założenia prognozy

- 1200 symulacji Monte Carlo; niezależne losowanie nakładu z rozkładu jednostajnego
  między min i max. P85 to 85. percentyl dat ukończenia (nearest rank).
- Capacity jest rozłożone równo na dni poniedziałek–piątek danego miesiąca.
  Święta nie są uwzględniane. W bieżącym miesiącu wykorzystujemy tylko dni od dziś.
- Wspólna pula zasobów to **zespół × kompetencja**. Różne pule pracują równolegle;
  nie należy liczyć dni tej samej osoby w kilku kompetencjach.
- Elementy inicjatywy są sekwencyjne: następny rusza najwcześniej w kolejnym
  dniu roboczym po zakończeniu poprzedniego. Kolejność inicjatyw rozstrzyga
  konkurencję o capacity, ale nie blokuje innych dostępnych zasobów.
- Start elementu nie może poprzedzać startu inicjatywy; daty z przeszłości
  są przesuwane do dziś. Fixed date jest celem, nie gwarancją ani twardym
  przesunięciem prognozy. Termin z szansą poniżej 85% jest oznaczony jako ryzykowny.
  Miniony termin nie blokuje prognozy, jeśli nie poprzedza żądanej daty startu;
  jego szansa dotrzymania wynosi 0%.
- Nieukończone scenariusze pozostają w mianowniku obliczeń. Jeśli mniej niż 85%
  przebiegów kończy się w kalendarzu, P85 jest oznaczony jako **poza horyzontem**.
  Dla fixed date poza horyzontem nie wyznaczamy prawdopodobieństwa.
- Pasek Gantta obejmuje P85 startu i P85 końca (nie przedział ufności).
  Wyniki mogą nieznacznie różnić się między przeliczeniami.

## Publiczna strona GitHub Pages

1. W repozytorium przejdź do **Settings → Pages → Build and deployment → Source**
   i wybierz **GitHub Actions**. Repozytorium musi pozwalać na publiczną publikację
   Pages oraz uruchamianie Actions.
2. Po połączeniu zmian z domyślną gałęzią workflow **Validate and publish dashboard**
   sprawdzi JavaScript i testy, a następnie opublikuje stronę. Można też uruchomić
   go ręcznie w **Actions** na domyślnej gałęzi.
3. Adres po udanym wdrożeniu:
   **https://sjaroszczak-dev.github.io/BOARD-_2/** (bez niestandardowej domeny).
   Potwierdzony adres wdrożenia jest także dostępny w środowisku `github-pages`.

Pull requesty i inne gałęzie uruchamiają walidację, ale nie publikują strony.
Do artefaktu Pages trafiają wyłącznie `index.html`, `styles.css`, `forecast.js`
i `app.js`. Publikacja wymaga włączenia Pages w ustawieniach — samo dodanie plików
nie oznacza, że strona jest już dostępna publicznie.

## Lokalnie i testy

Uruchom z katalogu repozytorium:

```sh
python -m http.server 8000
```

Otwórz **http://localhost:8000**. Używaj lokalnego serwera zamiast `file://`,
aby zapewnić obsługę `crypto.randomUUID` i lokalnego zapisu.

Testy korzystają z wbudowanego runnera Node.js (Node 22+, bez instalowania pakietów):

```sh
node --test forecast.test.js
node --check app.js
node --check forecast.js
```
