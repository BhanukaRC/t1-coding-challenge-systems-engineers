#!/bin/bash
docker exec t1-challenge-kafka /opt/kafka/bin/kafka-topics.sh --create --topic market --bootstrap-server localhost:9092 --replication-factor 1 --partitions 3
docker exec t1-challenge-kafka /opt/kafka/bin/kafka-topics.sh --create --topic trades --bootstrap-server localhost:9092 --replication-factor 1 --partitions 3