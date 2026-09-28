import metadata from 'libphonenumber-js/metadata.max.json';
import type { MetadataJson } from 'libphonenumber-js/core';

import { setPhoneMetadata } from './metadata';

setPhoneMetadata(metadata as unknown as MetadataJson);
