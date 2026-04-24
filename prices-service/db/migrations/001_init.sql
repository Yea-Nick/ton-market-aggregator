create table if not exists consumer_inbox (
    event_id text primary key,
    topic varchar(255) not null,
    partition int not null,
    partition_offset bigint not null,
    exchange varchar(50) not null,
    symbol varchar(20) not null,
    received_at timestamptz not null default now()
);

create table if not exists price_ticks (
    id bigserial primary key,
    event_id text not null unique,
    exchange varchar(50) not null,
    symbol varchar(20) not null,
    price numeric(20,10) not null,
    source_timestamp timestamptz not null,
    created_at timestamptz not null default now()
);

create index if not exists idx_price_ticks_symbol_exchange_ts
    on price_ticks(symbol, exchange, source_timestamp desc);
    
create index if not exists idx_consumer_inbox_received_at
    on consumer_inbox(received_at);