//@ts-check

// gcloud projects list

import { $ } from "zx";

const { PROJECT } = process.env;

const LOCATION = "asia-northeast1";
const NETWORK = "vpc-direct-vpc-egress";
const SUBNET = "subnet-direct-vpc-egress";
const ROUTER = "router-direct-vpc-egress";
const NAT = "nat-direct-vpc-egress";

await $`gcloud compute networks create ${NETWORK} \
    --project=${PROJECT} \
    --subnet-mode=custom`;

// https://cloud.google.com/run/docs/configuring/vpc-direct-vpc?hl=ja
// サポートされている IP 範囲
// Cloud Run では、サブネットで次の IPv4 範囲をサポートしています。

// RFC 1918（推奨）
// 10.0.0.0/8
// 172.16.0.0/12
// 192.168.0.0/16

await $`gcloud compute networks subnets create ${SUBNET} \
    --project=${PROJECT} \
    --network=${NETWORK} \
    --range=192.168.0.0/24 \
    --region=${LOCATION}`;

await $`gcloud compute routers create ${ROUTER} \
    --project=${PROJECT} \
    --network=${NETWORK} \
    --region=${LOCATION}`;

await $`gcloud compute routers nats create ${NAT} \
    --router=${ROUTER} \
    --region=${LOCATION} \
    --type=PUBLIC \
    --auto-network-tier=STANDARD \
    --auto-allocate-nat-external-ips \
    --nat-all-subnet-ip-ranges`;
