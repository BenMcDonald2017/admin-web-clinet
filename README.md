# Application Service

> API created using [Serverless](https://serverless.com/ "Build auto-scaling, pay-per-execution, event-driven apps on AWS Lambda.).

## Getting Started

Clone the repo and get started!

The main branch is `develop`. You'll want to branch off of `develop` to make your `feature/` branch while you work. After you're done, initiate a PR for your feature branch to be merged back into `develop`.

When we're ready to merge `develop` into `master` we should technically initiate another PR from `develop` into `master`

> **NOTE**:
>
> The `master` branch is _and ought to be_ production-ready code.

-  Development: (one-off, manual pushes) https://dev-api.hixme.com/application/ping
-  Integration: https://int-api.hixme.com/application/ping
-  Production:  https://api.hixme.com/application/ping

## Awesome Debugging:

1. Start Entire Service:

    ```shell
    npm start
    ```

2. Attach Your Debugger

In VS Code run the "Attach to (an Existing) Node Process" task, or connect a node-debugger to port `9229`.
