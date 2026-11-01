# Grokbot privacy information

Grokbot is an independent, locally executed package maintained by Sami Halawa. It sends the prompts and authentication material needed for your requested operations to the Grok service or another endpoint you configure. Returned answers, account metadata and conversation exports are available to the client or assistant invoking the tools.

Account configuration is read from your local configuration files or environment. Configuration can contain session credentials or references to credentials in 1Password. Pool counters, cooldowns and conversation routing state are stored locally under `.grokbot`. Export operations read available remote conversations and, when configured, local Grok Bot persistence; an explicit output path writes a local export and can overwrite that file. The optional local HTTP proxy exposes its configured workflows to clients that connect to it.

This package does not include a publisher-operated collection endpoint or a hosted account. It does not provide an automatic deletion schedule for configuration, pool state or exports. Manage those files, vault items and upstream account data through their respective locations and services. Removing the package does not itself delete existing files or remote conversations. Grok, a configured proxy or vault service, and the assistant host apply their own data practices to the information they handle.

For package questions, use the support link in this repository. Do not put credentials or private conversation exports in a public issue.
