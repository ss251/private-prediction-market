# Lasagna - Wave 2 Demo Video Script

**Target length**: 2-3 minutes
**Format**: Screen recording with voiceover (or text overlays)
**Live site**: https://lasagna-markets.vercel.app

---

## Scene 1: Intro (10s)

**Show**: Landing page / market list

**Text/VO**: "Lasagna is a private prediction market on Aleo. In Wave 2, we introduced Deferred Aggregate Revelation — bet direction is fully private, and pool totals are hidden until resolution."

---

## Scene 2: The Problem (15s)

**Show**: Side-by-side comparison or diagram

**Text/VO**: "In Wave 1, bet direction was passed as a public boolean directly to finalize, and pool totals updated on every bet. An observer could see exactly who bet what. Wave 2 fixes this completely."

---

## Scene 3: How DAR Works (20s)

**Show**: Privacy table on the site / diagram overlay

**Text/VO**: "During betting, pool totals stay at zero on-chain. Each bet generates a Pedersen commitment — an observer sees two group elements but can't determine which direction the bettor chose. Only at resolution are pool totals revealed and verified against the aggregate commitments."

---

## Scene 4: Pedersen Discovery (15s)

**Show**: Code snippet or diagram of m*G + r*H

**Text/VO**: "We discovered Aleo's built-in Pedersen128 is NOT additively homomorphic. We replaced it with standard m*G + r*H commitments using group::GEN and Poseidon2::hash_to_group — truly homomorphic, allowing correct on-chain verification at resolution."

---

## Scene 5: Live Demo - Browse Markets (15s)

**Show**: Click through market list, show open markets with hidden pools

**Text/VO**: "Here are our live markets on Testnet Beta. Notice open markets show 'Pools Hidden' — no sentiment signal leaks during active betting."

---

## Scene 6: Live Demo - Place a Bet (30s)

**Show**: Connect Shield Wallet → open bet modal → select YES/NO → confirm → transaction

**Text/VO**: "Let's place a bet. Connect Shield Wallet, choose a market, pick a direction and amount. The bet modal shows no odds or pool sizes — that would undermine privacy. Shield Wallet handles ZK proof generation via delegated proving."

---

## Scene 7: Live Demo - Resolved Markets (15s)

**Show**: Click on a resolved market (Market 1 or 2), show revealed pools and outcome

**Text/VO**: "Markets 1 and 2 are already resolved. Now you can see the pool totals and outcome — this data was hidden during betting and only revealed when the admin verified the aggregate Pedersen commitments."

---

## Scene 8: Admin Resolution (15s)

**Show**: Admin view with Resolve button visible (or CLI footage)

**Text/VO**: "Resolution is admin-only, enforced both in the UI and on-chain. The admin provides pool totals and summed blinding factors — the contract verifies these match the aggregate commitments before setting the outcome."

---

## Scene 9: Tech Stack (10s)

**Show**: README or overlay with tech stack

**Text/VO**: "Built with Leo, React, Shield Wallet, Supabase, and deployed on Aleo Testnet Beta. 84 tests passing — contract transitions, payout math, and ZK integration."

---

## Scene 10: Outro (10s)

**Show**: Landing page with links

**Text/VO**: "Lasagna — private prediction markets where your bets stay private. Try it live at lasagna-markets.vercel.app."

---

## Recording Notes

- Use Shield Wallet extension (must be installed)
- Admin wallet: `aleo1vuxp3mgw9tq25wzwwdn5vfrym45p444fq7rf9s4krd3rmne7xupqzl906l`
- Contract: `prediction_market_test007.aleo`
- Open markets (3, 4, 5) available for live bet demo
- Resolved markets (1, 2) show revealed pools
- If placing a live bet, ensure wallet has testnet credits
- Screen record at 1080p or higher
