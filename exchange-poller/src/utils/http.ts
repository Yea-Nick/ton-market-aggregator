import axios from 'axios';

export const http = axios.create({
  timeout: 8000,
  headers: {
    'User-Agent': 'ton-price-aggregator-exchange-poller',
    Accept: 'application/json',
  },
});
