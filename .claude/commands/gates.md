# MUSASHI — Gate Check

Run the 5 automated elimination gates on a token (Gates 1, 2, 3, 6, 7).

**Target:** $ARGUMENTS

## Execution

1. If the argument is a name/ticker, search first:
```bash
./scripts/musashi-core/musashi-core search "$QUERY"
```
Ask user to confirm which token before proceeding.

2. Run gates:
```bash
./scripts/musashi-core/musashi-core gates <token_address> --chain <chain_id> --output json
```

3. Report results clearly:
```
MUSASHI ⚔️ [Token Name] ($SYMBOL)

[PASS/FAIL] Gate 1: Contract Safety — [reason]
[PASS/FAIL] Gate 2: Liquidity — [reason]
[PASS/FAIL] Gate 3: Wallets — [reason]
[PASS/FAIL] Gate 6: Timing — [reason]
[PASS/FAIL] Gate 7: Cross-Val — [reason]

Token Age: [fresh/early/established]
```

If all gates pass, suggest running the full analysis with `/analyze`.
