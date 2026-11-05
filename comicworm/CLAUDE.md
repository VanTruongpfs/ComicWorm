# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

ComicWorm is a comic marketplace: buying and selling, exchange rooms, a chatbot and search by cover image. It is one Spring Boot 3.5.6 app (Java 21, Gradle, MySQL, packaged as a WAR) plus a small local Python service for image embeddings. The Git root is the parent folder; the project and every path below live in `comicworm/`. Development is on Windows and PowerShell.

## Commands

Run these from `comicworm/`.

```powershell
# Run the app (reads ./application-local.properties)
.\gradlew.bat bootRun --args='--spring.profiles.active=local'

# Build and test
.\gradlew.bat test bootWar
.\gradlew.bat test --tests '*ExchangeRoom*' --console=plain
.\gradlew.bat test --tests 'com.example.comicworm.SellerAccessTests.upgradeEndpointIsForbiddenForBuyers'

# Python embedding service tests
& services/image-embedding/.venv/Scripts/python.exe -m pip install -r services/image-embedding/requirements-test.txt
$env:PYTEST_DISABLE_PLUGIN_AUTOLOAD = '1'
& services/image-embedding/.venv/Scripts/python.exe -m pytest services/image-embedding -q

# Regenerate and check the database schema
python database/build_schema.py
python database/verify_mysql.py --mysql-bin "C:\Program Files\MySQL\MySQL Server 9.0\bin"
```

There is no linter or formatter configured. Test reports are in `build/reports/tests/test/index.html`.

First-time setup is in `docs/new-machine-setup.md`: import `database/schema.sql` then `database/seed.sql` into a new database (`bookmooch_db_v3`), and copy `application-local.example.properties` to `application-local.properties`. The image search Python setup is in `docs/image-search.md` and the chatbot's Ollama setup is in `docs/chatbot-ollama-setup.md`.

### Tests

- **Test types:** most tests are Mockito unit tests or `@WebMvcTest` slices. `@SpringBootTest` classes need a reachable MySQL.
- **Opt-in tests:** these are skipped unless their variable is `true`: `JPA_INTEGRATION_TEST`, `ANALYTICS_MYSQL_TEST`, `EXCHANGE_MYSQL_TEST`, `IMAGE_SEARCH_MYSQL_TEST`, `PRODUCTS_MYSQL_TEST`, `IMAGE_SEARCH_AUTOSTART_LIVE_TEST`, `OLLAMA_AUTOSTART_LIVE_TEST`.
- **`tools/verify_*_mysql.py`:** these start a throwaway MySQL instance, import the schema and run the tests, without touching the configured database. Several default `--java-home` to one developer's JDK path, so pass your own.
- **`tools/verify_*_browser.cjs`:** these need Playwright on `NODE_PATH` and Chrome.
- **`tools/verify_spring_mysql.py`:** it asserts exactly 2 test suites and no skipped tests, which no longer matches the test suite. Expect it to fail until it is updated.

Baseline on 2026-11-01, with MySQL not running: 274 tests, 16 failed, 37 skipped. Compare against this before assuming you broke something.

| Failing tests | Cause |
| --- | --- |
| `ComicwormApplicationTests` (4), `CodOrderMySqlIntegrationTests` (1), `SellerReviewRepositoryMySqlTests` (1) | MySQL connection refused |
| `AccountProfileTests` (6), `ProductModerationTests` (2), `SellerAccessTests` (2) | Assertion or service errors unrelated to MySQL |

`ComicwormApplicationTests.opensHomeAndProtectsFutureApi` also expects no `EntityManagerFactory` and a 401 from `/api/products`. Neither matches the current `SecurityConfig` and preview config, so MySQL alone is unlikely to fix it.

## Configuration

- **Gitignored config:** `application.properties`, `application-local.properties` and `application-preview.properties` are all gitignored, so a fresh clone has none of them. The tracked templates are `application-local.example.properties` and `src/main/resources/application-preview.example.properties`. Add new settings to the templates too. The ignore rules also match `*.example.properties`, so a new template needs `git add -f`.
- **`local` profile:** the normal development profile. Its template sets `ddl-auto=update`, so entity changes reach the local database without a migration.
- **`preview` profile:** roughly 25 beans are marked `@Profile("!preview")`, including seller, admin, exchange and analytics controllers and services, plus scheduling. Don't use it to run those features or image indexing. With the current config it still tries to connect to MySQL.

## Architecture

Requests flow `controller → service → repository → model`. Controllers return DTOs or view names, never entities. Some services are an interface plus `impl`; newer ones are concrete classes.

### Security (`config/SecurityConfig.java`)

- **Auth:** JWTs are carried in the httpOnly cookies `accessToken` and `refreshToken`, not an `Authorization` header. `JwtAuthenticationFilter` silently issues a new access token from a valid refresh token.
- **Roles:** `ROLE_USER` or `ROLE_ADMIN` comes from `users.role`. `ROLE_SELLER` is added separately when `is_seller` is true (`CustomUserDetails`).
- **Public by default:** the chain ends in `.anyRequest().permitAll()`, so a new endpoint is public unless a matcher or method security covers it. `/api/cart/**` and `/api/checkout/**` are also public; check who the caller is inside those handlers.
- **CSRF only on some paths:** it applies to writes on `/api/seller/**`, `/api/admin/**`, `/api/account/**` and `/user/seller-upgrade`. Frontend code on those paths must fetch a token (for example `/api/account/csrf` or `/api/seller/products/csrf`) and send it as a header. `seller/js/products-api.js` and `shared/js/account-api.js` show the pattern.
- **CORS:** it is configured per path for Live Server origins (ports 5500 and 5501).

### Frontend

There is no bundler or Node build. `ViewController` maps `/{admin|auth|buyer|exchange|seller|user}/html/{page}.html` to `templates/view/{area}/html/{page}.html`, so adding a file in one of those areas creates the page. CSS and JS sit in `static/{area}/`, shared components in `static/shared/`, and vendored jQuery and jTable in `static/shared/vendor/`. Page JS loads data from the JSON APIs.

Some screens, such as vouchers, wallet, withdrawal and customer support, are legacy UI with no backing tables. Check `database/FUNCTION_MAP.md` before wiring them up. It maps the 25 functions in agreed scope to tables, and tables for dropped features should not be added.

### Data model

- **Writing relations:** write foreign keys through ID fields (`product.setSellerId(id)`). Relations such as `product.getSeller()` are lazy and read-only, with no setters.
- **Deleting:** history tables have no delete cascades, and users and products are soft-deleted (`deleted_at`).
- **Value types:** money is `BigDecimal` and times are stored in UTC. Composite keys are in `model/id/`.
- **Schema changes:** `schema.sql` and the DBML files are generated from `database/schema_model.py` by `build_schema.py`. Nothing runs SQL at startup (`spring.sql.init.mode=never`), so `database/migrations/` scripts are applied by hand.
- **Schema checks:** `build_schema.py` has no `--help`; any invocation regenerates the files, so diff `schema.sql` afterwards. `database/verify_scope_mysql.py` asserts exact table/column/FK counts; bump them when the schema changes.

### Cross-cutting flows

- **Moderation:** any seller create or edit resets `moderation_status` to `PENDING`. Public listings and image search only show products that are `APPROVED`, active and not deleted.
- **Orders and payments:** `OrderStatus` runs from `WAITING_PAYMENT` or `WAITING_CONFIRM` through `PACKING`, `SHIPPING` and `DELIVERED` to `COMPLETED`, or to `CANCELLED`. Payment is COD or VNPay.
- **Refunds:** these go through the `RefundGateway` interface, and `MockRefundGateway` is the only implementation.
- **Background jobs:** `OrderPaymentExpiryJob` runs every 60s, `RefundProcessor` every 30s and `OrderAutoCompletionJob` hourly. `ImageFeatureIndexer` has its own scheduler so it can't delay the others.
- **Exchange rooms:** REST lives under `/api/exchange` and chat is a raw WebSocket at `/ws/exchange/*`. Room status `COMPLETED` means both parties confirmed the deal, not that anything was delivered. Events are published after the transaction commits, and the UI polls when the socket drops (`docs/exchange-rooms.md`).
- **Exchange review and escrow:** once every delivery order of a deal exists, `exchange_offers.admin_review_status` becomes `PENDING` and the sender cannot `ACCEPT`/`SHIP` until an admin approves (`/api/admin/exchange`, page `admin/html/exchange-deals.html`). The cash compensation is held in `exchange_escrows` when the payer pays COD, and an admin releases it to the payee's `wallets` row or refunds it to the payer. Wallets only receive money; there is no withdrawal.
- **Image search:** Spring starts and stops `services/image-embedding` (FastAPI and CLIP on port 8091) through `ImageEmbeddingProcessManager`. Vectors are stored as JSON in `product_image_features` and compared with cosine similarity in Java. `MODEL_NAME` in `app.py` and `app.image-search.model-name` must change together; vectors with another model name get re-indexed.
- **Chatbot:** `ChatAiController` and `service/ai/ProductSearchTool` use the Spring AI OpenAI starter pointed at local Ollama (model `qwen-comicworm`). With `app.chatbot.ollama.auto-start=true` (local profile), `OllamaProcessManager` starts `ollama serve` if nothing answers on the base URL, creates the model from `chatbot/Modelfile` (gitignored, with the `.gguf`) if missing, and preloads it. The model sometimes answers intents by number, which `ChatAiController.normalizeIntent` maps back. Gemini references in `docs/new-machine-setup.md` and the `build.gradle` comment are out of date.
- **Product images:** uploads go to Cloudinary and only URLs are stored (`docs/cloudinary.md`). Image downloads for indexing are limited to `app.image-search.allowed-image-hosts`.

The README's entity, table and file counts are out of date: `schema.sql` has 38 tables, not 32. Feature details are in `docs/`.
