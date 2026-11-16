-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(320) NOT NULL,
    `username` VARCHAR(191) NOT NULL,
    `displayName` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `role` ENUM('SUPER_ADMIN', 'ADMIN', 'LEAD_DEV', 'DEVELOPER') NOT NULL DEFAULT 'DEVELOPER',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `avatarColor` VARCHAR(191) NOT NULL DEFAULT '#5865F2',
    `jobTitle` VARCHAR(191) NULL,
    `discordId` VARCHAR(191) NULL,
    `timezone` VARCHAR(191) NOT NULL DEFAULT 'Europe/Paris',
    `permissionsGranted` JSON NULL,
    `permissionsDenied` JSON NULL,
    `twoFactorEnabled` BOOLEAN NOT NULL DEFAULT false,
    `twoFactorSecret` VARCHAR(191) NULL,
    `twoFactorRecoveryCodes` JSON NULL,
    `mustChangePassword` BOOLEAN NOT NULL DEFAULT false,
    `failedLoginCount` INTEGER NOT NULL DEFAULT 0,
    `lockedUntil` DATETIME(3) NULL,
    `lastLoginAt` DATETIME(3) NULL,
    `lastSeenAt` DATETIME(3) NULL,
    `notificationPrefs` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    UNIQUE INDEX `User_username_key`(`username`),
    INDEX `User_role_idx`(`role`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuthSession` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `tokenHash` VARCHAR(191) NOT NULL,
    `ip` VARCHAR(45) NULL,
    `userAgent` VARCHAR(512) NULL,
    `deviceName` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastUsedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,
    `revokedAt` DATETIME(3) NULL,

    UNIQUE INDEX `AuthSession_tokenHash_key`(`tokenHash`),
    INDEX `AuthSession_userId_idx`(`userId`),
    INDEX `AuthSession_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LoginEvent` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `email` VARCHAR(320) NOT NULL,
    `success` BOOLEAN NOT NULL,
    `reason` VARCHAR(512) NULL,
    `ip` VARCHAR(45) NULL,
    `userAgent` VARCHAR(512) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `LoginEvent_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `LoginEvent_email_createdAt_idx`(`email`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DevSession` (
    `id` VARCHAR(191) NOT NULL,
    `number` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` VARCHAR(191) NOT NULL,
    `status` ENUM('ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE',
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `endedAt` DATETIME(3) NULL,
    `lastResumedAt` DATETIME(3) NULL,
    `lastActivityAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `accumulatedActiveSeconds` INTEGER NOT NULL DEFAULT 0,
    `idleTimeoutMinutes` INTEGER NOT NULL DEFAULT 15,
    `idleWarningSentAt` DATETIME(3) NULL,
    `summary` TEXT NULL,
    `notes` TEXT NULL,
    `closedById` VARCHAR(191) NULL,
    `currentTaskId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `DevSession_number_key`(`number`),
    INDEX `DevSession_userId_status_idx`(`userId`, `status`),
    INDEX `DevSession_startedAt_idx`(`startedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DevSessionEvent` (
    `id` VARCHAR(191) NOT NULL,
    `sessionId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `type` ENUM('START', 'PAUSE', 'RESUME', 'END', 'NOTE', 'TASK_SWITCH', 'FILE_CHANGE', 'IDLE_WARNING', 'IDLE_ACK', 'VALIDATION') NOT NULL,
    `message` TEXT NULL,
    `taskId` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `DevSessionEvent_sessionId_createdAt_idx`(`sessionId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Task` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `status` ENUM('BACKLOG', 'TODO', 'IN_PROGRESS', 'TESTING', 'REVIEW', 'DONE', 'BLOCKED') NOT NULL DEFAULT 'BACKLOG',
    `priority` ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT') NOT NULL DEFAULT 'MEDIUM',
    `category` ENUM('SCRIPT', 'UI', 'MAPPING', 'VEHICLES', 'OPTIMIZATION', 'DATABASE', 'CONFIG', 'SECURITY', 'BUGFIX', 'GAMEPLAY', 'ADMINISTRATION') NOT NULL DEFAULT 'SCRIPT',
    `assigneeId` VARCHAR(191) NULL,
    `creatorId` VARCHAR(191) NOT NULL,
    `parentId` VARCHAR(191) NULL,
    `resource` VARCHAR(120) NULL,
    `files` JSON NULL,
    `tags` JSON NULL,
    `dueDate` DATETIME(3) NULL,
    `estimatedMinutes` INTEGER NULL,
    `timeSpentSeconds` INTEGER NOT NULL DEFAULT 0,
    `autoValidate` BOOLEAN NOT NULL DEFAULT false,
    `requiresReview` BOOLEAN NOT NULL DEFAULT true,
    `validationCriteria` JSON NULL,
    `completedAt` DATETIME(3) NULL,
    `validatedAt` DATETIME(3) NULL,
    `validatedById` VARCHAR(191) NULL,
    `validationKind` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Task_code_key`(`code`),
    INDEX `Task_status_idx`(`status`),
    INDEX `Task_assigneeId_idx`(`assigneeId`),
    INDEX `Task_resource_idx`(`resource`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TaskDependency` (
    `id` VARCHAR(191) NOT NULL,
    `taskId` VARCHAR(191) NOT NULL,
    `dependsOnId` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `TaskDependency_taskId_dependsOnId_key`(`taskId`, `dependsOnId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TaskChecklistItem` (
    `id` VARCHAR(191) NOT NULL,
    `taskId` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `done` BOOLEAN NOT NULL DEFAULT false,
    `assigneeId` VARCHAR(191) NULL,
    `position` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `TaskChecklistItem_taskId_idx`(`taskId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TaskComment` (
    `id` VARCHAR(191) NOT NULL,
    `taskId` VARCHAR(191) NOT NULL,
    `authorId` VARCHAR(191) NOT NULL,
    `body` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `TaskComment_taskId_createdAt_idx`(`taskId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TaskAttachment` (
    `id` VARCHAR(191) NOT NULL,
    `taskId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `size` INTEGER NOT NULL,
    `storageKey` VARCHAR(512) NOT NULL,
    `uploadedById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `TaskAttachment_taskId_idx`(`taskId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Bug` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `description` TEXT NOT NULL,
    `severity` ENUM('CRITICAL', 'HIGH', 'MEDIUM', 'LOW') NOT NULL DEFAULT 'MEDIUM',
    `status` ENUM('NEW', 'TRIAGE', 'FIXING', 'TESTING', 'FIXED', 'CLOSED') NOT NULL DEFAULT 'NEW',
    `resource` VARCHAR(191) NULL,
    `filePath` VARCHAR(512) NULL,
    `reproduceSteps` TEXT NULL,
    `expectedResult` TEXT NULL,
    `actualResult` TEXT NULL,
    `logs` TEXT NULL,
    `screenshots` JSON NULL,
    `reporterId` VARCHAR(191) NOT NULL,
    `assigneeId` VARCHAR(191) NULL,
    `taskId` VARCHAR(191) NULL,
    `fixValidated` BOOLEAN NOT NULL DEFAULT false,
    `fixedAt` DATETIME(3) NULL,
    `closedAt` DATETIME(3) NULL,
    `autoCloseBlocked` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Bug_code_key`(`code`),
    INDEX `Bug_status_idx`(`status`),
    INDEX `Bug_severity_idx`(`severity`),
    INDEX `Bug_assigneeId_idx`(`assigneeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BugComment` (
    `id` VARCHAR(191) NOT NULL,
    `bugId` VARCHAR(191) NOT NULL,
    `authorId` VARCHAR(191) NOT NULL,
    `body` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `BugComment_bugId_createdAt_idx`(`bugId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Resource` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `folder` VARCHAR(512) NOT NULL,
    `state` VARCHAR(191) NOT NULL DEFAULT 'unknown',
    `version` VARCHAR(191) NULL,
    `author` VARCHAR(191) NULL,
    `description` TEXT NULL,
    `dependencies` JSON NULL,
    `missingDependencies` JSON NULL,
    `manifest` JSON NULL,
    `fileCount` INTEGER NOT NULL DEFAULT 0,
    `sizeBytes` BIGINT NOT NULL DEFAULT 0,
    `ownerId` VARCHAR(191) NULL,
    `lastModifiedAt` DATETIME(3) NULL,
    `lastDeployAt` DATETIME(3) NULL,
    `lastRunState` VARCHAR(191) NULL,
    `lastRunStateAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Resource_name_key`(`name`),
    INDEX `Resource_name_idx`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TrackedFile` (
    `id` VARCHAR(191) NOT NULL,
    `path` VARCHAR(512) NOT NULL,
    `resource` VARCHAR(191) NULL,
    `hash` VARCHAR(191) NULL,
    `size` INTEGER NOT NULL DEFAULT 0,
    `remoteModifiedAt` DATETIME(3) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `lockedById` VARCHAR(191) NULL,
    `lockedAt` DATETIME(3) NULL,
    `lockExpiresAt` DATETIME(3) NULL,
    `lastCheckedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `TrackedFile_path_key`(`path`),
    INDEX `TrackedFile_resource_idx`(`resource`),
    INDEX `TrackedFile_lockedById_idx`(`lockedById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FileChange` (
    `id` VARCHAR(191) NOT NULL,
    `path` VARCHAR(512) NOT NULL,
    `resource` VARCHAR(191) NULL,
    `changeType` ENUM('FILE_CREATED', 'FILE_MODIFIED', 'FILE_DELETED', 'FILE_RENAMED', 'FOLDER_CREATED', 'FOLDER_DELETED') NOT NULL,
    `source` ENUM('EDITOR', 'UPLOAD', 'API', 'SYNC', 'DEPLOYMENT', 'ROLLBACK') NOT NULL DEFAULT 'EDITOR',
    `hashBefore` VARCHAR(191) NULL,
    `hashAfter` VARCHAR(191) NULL,
    `sizeBefore` INTEGER NULL,
    `sizeAfter` INTEGER NULL,
    `diff` TEXT NULL,
    `oldContent` TEXT NULL,
    `newContent` TEXT NULL,
    `userId` VARCHAR(191) NULL,
    `sessionId` VARCHAR(191) NULL,
    `taskId` VARCHAR(191) NULL,
    `bugId` VARCHAR(191) NULL,
    `taskMatchScore` INTEGER NULL,
    `taskMatchReason` TEXT NULL,
    `validated` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `FileChange_createdAt_idx`(`createdAt`),
    INDEX `FileChange_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `FileChange_taskId_idx`(`taskId`),
    INDEX `FileChange_path_idx`(`path`),
    INDEX `FileChange_sessionId_idx`(`sessionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Report` (
    `id` VARCHAR(191) NOT NULL,
    `number` INTEGER NOT NULL AUTO_INCREMENT,
    `sessionId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `startedAt` DATETIME(3) NOT NULL,
    `endedAt` DATETIME(3) NOT NULL,
    `durationSeconds` INTEGER NOT NULL DEFAULT 0,
    `activeSeconds` INTEGER NOT NULL DEFAULT 0,
    `data` JSON NOT NULL,
    `summary` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Report_number_key`(`number`),
    UNIQUE INDEX `Report_sessionId_key`(`sessionId`),
    INDEX `Report_userId_createdAt_idx`(`userId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PatchNote` (
    `id` VARCHAR(191) NOT NULL,
    `version` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `subtitle` VARCHAR(191) NULL,
    `internalBody` TEXT NOT NULL,
    `publicBody` TEXT NOT NULL,
    `status` ENUM('DRAFT', 'REVIEW', 'APPROVED', 'SCHEDULED', 'PUBLISHED') NOT NULL DEFAULT 'DRAFT',
    `sessionId` VARCHAR(191) NULL,
    `authorId` VARCHAR(191) NOT NULL,
    `approvedById` VARCHAR(191) NULL,
    `approvedAt` DATETIME(3) NULL,
    `scheduledAt` DATETIME(3) NULL,
    `publishedAt` DATETIME(3) NULL,
    `aiGenerated` BOOLEAN NOT NULL DEFAULT false,
    `contentHash` VARCHAR(191) NULL,
    `discordMessageId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PatchNote_status_idx`(`status`),
    INDEX `PatchNote_version_idx`(`version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DiscordWebhook` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `kind` ENUM('PATCH_NOTES', 'REPORTS', 'ERRORS', 'SESSIONS', 'NOTIFICATIONS', 'DEPLOYMENTS') NOT NULL,
    `urlEnc` TEXT NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `username` VARCHAR(191) NULL,
    `avatarUrl` VARCHAR(512) NULL,
    `lastUsedAt` DATETIME(3) NULL,
    `lastError` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `DiscordWebhook_kind_enabled_idx`(`kind`, `enabled`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DiscordDelivery` (
    `id` VARCHAR(191) NOT NULL,
    `webhookId` VARCHAR(191) NOT NULL,
    `patchNoteId` VARCHAR(191) NULL,
    `payloadHash` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `httpStatus` INTEGER NULL,
    `error` TEXT NULL,
    `messageId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `DiscordDelivery_patchNoteId_idx`(`patchNoteId`),
    UNIQUE INDEX `DiscordDelivery_webhookId_payloadHash_key`(`webhookId`, `payloadHash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Deployment` (
    `id` VARCHAR(191) NOT NULL,
    `resource` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'DEPLOYED', 'FAILED', 'ROLLED_BACK') NOT NULL DEFAULT 'PENDING',
    `title` VARCHAR(200) NOT NULL,
    `requestedById` VARCHAR(191) NOT NULL,
    `approvedById` VARCHAR(191) NULL,
    `approvedAt` DATETIME(3) NULL,
    `rejectedReason` TEXT NULL,
    `changes` JSON NOT NULL,
    `files` JSON NULL,
    `logs` TEXT NULL,
    `snapshotId` VARCHAR(191) NULL,
    `deployedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Deployment_status_idx`(`status`),
    INDEX `Deployment_resource_idx`(`resource`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Snapshot` (
    `id` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `kind` ENUM('MANUAL', 'PRE_WRITE', 'PRE_DEPLOYMENT', 'SESSION_END') NOT NULL DEFAULT 'MANUAL',
    `resource` VARCHAR(191) NOT NULL,
    `path` VARCHAR(512) NULL,
    `storageKey` VARCHAR(512) NOT NULL,
    `sizeBytes` BIGINT NOT NULL DEFAULT 0,
    `checksum` VARCHAR(191) NULL,
    `fileCount` INTEGER NOT NULL DEFAULT 0,
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Snapshot_resource_createdAt_idx`(`resource`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Notification` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `body` TEXT NULL,
    `link` VARCHAR(512) NULL,
    `readAt` DATETIME(3) NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Notification_userId_readAt_idx`(`userId`, `readAt`),
    INDEX `Notification_userId_createdAt_idx`(`userId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` VARCHAR(191) NOT NULL,
    `actorId` VARCHAR(191) NULL,
    `actorLabel` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `targetType` VARCHAR(191) NULL,
    `targetId` VARCHAR(191) NULL,
    `result` ENUM('SUCCESS', 'FAILURE', 'DENIED') NOT NULL DEFAULT 'SUCCESS',
    `ip` VARCHAR(45) NULL,
    `userAgent` VARCHAR(512) NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuditLog_createdAt_idx`(`createdAt`),
    INDEX `AuditLog_action_idx`(`action`),
    INDEX `AuditLog_actorId_createdAt_idx`(`actorId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PterodactylConfig` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL DEFAULT 'Principal',
    `panelUrl` VARCHAR(512) NOT NULL,
    `serverId` VARCHAR(191) NOT NULL,
    `serverIdentifier` VARCHAR(191) NULL,
    `nodeId` VARCHAR(191) NULL,
    `clientApiKeyEnc` TEXT NOT NULL,
    `applicationApiKeyEnc` TEXT NULL,
    `isDefault` BOOLEAN NOT NULL DEFAULT true,
    `statusCache` JSON NULL,
    `lastCheckedAt` DATETIME(3) NULL,
    `lastError` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SftpConfig` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL DEFAULT 'Principal',
    `host` VARCHAR(191) NOT NULL,
    `port` INTEGER NOT NULL DEFAULT 2022,
    `username` VARCHAR(191) NOT NULL,
    `authType` ENUM('KEY', 'PASSWORD') NOT NULL DEFAULT 'KEY',
    `passwordEnc` TEXT NULL,
    `privateKeyEnc` TEXT NULL,
    `passphraseEnc` TEXT NULL,
    `remoteRoot` VARCHAR(512) NOT NULL DEFAULT '/',
    `isDefault` BOOLEAN NOT NULL DEFAULT true,
    `lastCheckAt` DATETIME(3) NULL,
    `lastError` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AppSetting` (
    `key` VARCHAR(191) NOT NULL,
    `value` JSON NOT NULL,
    `encrypted` BOOLEAN NOT NULL DEFAULT false,
    `updatedAt` DATETIME(3) NOT NULL,
    `updatedById` VARCHAR(191) NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_SessionTasks` (
    `A` VARCHAR(191) NOT NULL,
    `B` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `_SessionTasks_AB_unique`(`A`, `B`),
    INDEX `_SessionTasks_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `AuthSession` ADD CONSTRAINT `AuthSession_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LoginEvent` ADD CONSTRAINT `LoginEvent_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DevSession` ADD CONSTRAINT `DevSession_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DevSessionEvent` ADD CONSTRAINT `DevSessionEvent_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `DevSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DevSessionEvent` ADD CONSTRAINT `DevSessionEvent_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Task` ADD CONSTRAINT `Task_assigneeId_fkey` FOREIGN KEY (`assigneeId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Task` ADD CONSTRAINT `Task_creatorId_fkey` FOREIGN KEY (`creatorId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Task` ADD CONSTRAINT `Task_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `Task`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TaskDependency` ADD CONSTRAINT `TaskDependency_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `Task`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TaskDependency` ADD CONSTRAINT `TaskDependency_dependsOnId_fkey` FOREIGN KEY (`dependsOnId`) REFERENCES `Task`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TaskChecklistItem` ADD CONSTRAINT `TaskChecklistItem_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `Task`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TaskChecklistItem` ADD CONSTRAINT `TaskChecklistItem_assigneeId_fkey` FOREIGN KEY (`assigneeId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TaskComment` ADD CONSTRAINT `TaskComment_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `Task`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TaskComment` ADD CONSTRAINT `TaskComment_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TaskAttachment` ADD CONSTRAINT `TaskAttachment_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `Task`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TaskAttachment` ADD CONSTRAINT `TaskAttachment_uploadedById_fkey` FOREIGN KEY (`uploadedById`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Bug` ADD CONSTRAINT `Bug_reporterId_fkey` FOREIGN KEY (`reporterId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Bug` ADD CONSTRAINT `Bug_assigneeId_fkey` FOREIGN KEY (`assigneeId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Bug` ADD CONSTRAINT `Bug_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `Task`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BugComment` ADD CONSTRAINT `BugComment_bugId_fkey` FOREIGN KEY (`bugId`) REFERENCES `Bug`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BugComment` ADD CONSTRAINT `BugComment_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Resource` ADD CONSTRAINT `Resource_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TrackedFile` ADD CONSTRAINT `TrackedFile_lockedById_fkey` FOREIGN KEY (`lockedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FileChange` ADD CONSTRAINT `FileChange_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FileChange` ADD CONSTRAINT `FileChange_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `DevSession`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FileChange` ADD CONSTRAINT `FileChange_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `Task`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FileChange` ADD CONSTRAINT `FileChange_bugId_fkey` FOREIGN KEY (`bugId`) REFERENCES `Bug`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Report` ADD CONSTRAINT `Report_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `DevSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Report` ADD CONSTRAINT `Report_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PatchNote` ADD CONSTRAINT `PatchNote_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `DevSession`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PatchNote` ADD CONSTRAINT `PatchNote_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PatchNote` ADD CONSTRAINT `PatchNote_approvedById_fkey` FOREIGN KEY (`approvedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DiscordDelivery` ADD CONSTRAINT `DiscordDelivery_webhookId_fkey` FOREIGN KEY (`webhookId`) REFERENCES `DiscordWebhook`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DiscordDelivery` ADD CONSTRAINT `DiscordDelivery_patchNoteId_fkey` FOREIGN KEY (`patchNoteId`) REFERENCES `PatchNote`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Deployment` ADD CONSTRAINT `Deployment_requestedById_fkey` FOREIGN KEY (`requestedById`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Deployment` ADD CONSTRAINT `Deployment_approvedById_fkey` FOREIGN KEY (`approvedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Snapshot` ADD CONSTRAINT `Snapshot_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_SessionTasks` ADD CONSTRAINT `_SessionTasks_A_fkey` FOREIGN KEY (`A`) REFERENCES `DevSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_SessionTasks` ADD CONSTRAINT `_SessionTasks_B_fkey` FOREIGN KEY (`B`) REFERENCES `Task`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

