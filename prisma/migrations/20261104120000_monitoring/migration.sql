-- Surveillance : historique des ressources serveur echantillonnees par le worker
CREATE TABLE `MetricSample` (
    `id` VARCHAR(191) NOT NULL,
    `state` VARCHAR(32) NOT NULL DEFAULT 'unknown',
    `cpuPercent` DOUBLE NOT NULL DEFAULT 0,
    `memoryBytes` BIGINT NOT NULL DEFAULT 0,
    `memoryLimitBytes` BIGINT NOT NULL DEFAULT 0,
    `diskBytes` BIGINT NOT NULL DEFAULT 0,
    `diskLimitBytes` BIGINT NOT NULL DEFAULT 0,
    `networkRxBytes` BIGINT NOT NULL DEFAULT 0,
    `networkTxBytes` BIGINT NOT NULL DEFAULT 0,
    `uptimeSeconds` INTEGER NOT NULL DEFAULT 0,
    `recordedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `MetricSample_recordedAt_idx`(`recordedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
