[![npm](https://img.shields.io/npm/v/tezos-metamask-snap.svg?colorB=brightgreen)](https://www.npmjs.com/package/tezos-metamask-snap)
[![documentation](https://img.shields.io/badge/documentation-online-brightgreen.svg)](https://github.com/airgap-it/tezos-metamask-snap/wiki)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=airgap-it_tezos-metamask-snap&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=airgap-it_tezos-metamask-snap)
[![Known Vulnerabilities](https://snyk.io/test/github/airgap-it/tezos-metamask-snap/badge.svg)](https://snyk.io/test/github/airgap-it/tezos-metamask-snap/)

# Tezos Wallet Snap

The Tezos Wallet Snap is a MetaMask extension that adds Tezos functionality to MetaMask, such as address generation and transaction signing.

Visit https://metamask.tezos.com to interact with the Snap.

## Development

Install the dependencies

```shell
yarn install
```

Build and start the local development server

```bash
yarn start
```

The example dApp to interact with the Snap is available at `http://localhost:8000`.

## Using the Snap

The production snap is available as Snap `npm:tezos-metamask-snap`.

Visit https://metamask.tezos.com to interact with the Snap.

## RPC selection and failover

The default mainnet RPC is `https://tezos-mainnet.octez.io/`. During operation
preparation, the Snap can retry once using `https://rpc.tzkt.io/mainnet/` if the
default provider is unavailable. Both providers are checked against mainnet chain
ID `NetXdQprcVkpaWU`, with a head no older than two minutes (and no more than 30
seconds in the future). Keep the device clock accurate.

`tezos_setRpc` accepts `{ network, nodeUrl }`, where `network` is `mainnet`,
`ghostnet`, `shadownet` or `custom`. The URL must be HTTPS, without credentials,
query parameters or fragments. The Snap checks HTTP status, the chain ID and
header before asking for confirmation and storing a normalized URL with a trailing
slash. The response retains the existing `{ network, nodeUrl }` shape and echoes
the supplied URL. A `custom` network accepts any valid, internally consistent
chain ID; named networks must match their chain ID.

Explicit RPC settings, including an explicitly selected Octez URL, use only that
provider. They never send account/activity data to a fallback without consent.
`tezos_clearRpc` restores the default mainnet policy. The sole legacy exception is
a saved **mainnet** URL exactly equal to
`https://blockchain-nodes.papers.tech/tezos/metamask/`: this is treated as the retired
default and resolved to the new default policy without rewriting storage. Other
URLs and all non-mainnet configurations remain unchanged.

`tezos_getRpc` reports the configured/preferred endpoint, not a temporary fallback.
Its public response shape is unchanged. The operation confirmation lists both
providers when default failover is enabled. Failover covers the Snap's RPC reads
and simulation during preparation; it does not affect independent requests made
by a dApp using the URL returned by `tezos_getRpc`.

Each HTTP request, including its body, has a five-second timeout. Connection
failures, timeouts, HTTP 429, unstructured 5xx errors and invalid RPC data may cause
preparation to restart on the fallback. HTTP 4xx errors other than 429 and
structured Tezos rejections (including those delivered with HTTP 500) are surfaced
without retrying. If both providers fail, an error is returned. A balance read
returns zero only for a valid numeric zero response; a generic 404 or network
failure is not evidence of a zero balance.

Every preparation attempt starts from a fresh copy of the approved operations.
Counter, manager key, recipient balance and simulation use the same provider and
pinned current-head block (also used as the operation branch). Signing happens once, after preparation succeeds. Injection
uses that provider exactly once, outside the retry loop. A lost/timed-out response,
unstructured server error or invalid injection response produces **Broadcast
outcome unknown**: check the account on-chain before submitting again. The Snap
never automatically re-signs or rebroadcasts an uncertain operation.

### Publishing the update

Merging source changes does not update installed production Snaps. Maintainers
must prepare a new package/manifest version, rebuild the Snap (including its
manifest shasum), complete the release review and publish `tezos-metamask-snap` to
npm. Follow the MetaMask distribution/update process and verify the new version in
a compatible MetaMask installation. Deploy the updated example/companion site at
`metamask.tezos.com` where applicable. No new Snap permissions are required.
