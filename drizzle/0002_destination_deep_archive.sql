-- Backups now go to Glacier Deep Archive. Storage class isn't user-editable yet, so existing
-- Destinations still hold the old seeded default; move them over.
UPDATE `destinations` SET `storage_class` = 'DEEP_ARCHIVE' WHERE `storage_class` = 'STANDARD';
