# Module boundaries

Domain modules contain deterministic business rules and do not import HTTP, React,
database, Supabase, or WebMCP code. Application modules orchestrate domain rules
and repository ports. Adapters (App Router, WebMCP, and repositories) are thin:
they authenticate, validate input, call application use cases, and map safe output.

No adapter may bypass a use case, mutate immutable history, accept caller supplied
prices, or derive actor identity from request body data.
