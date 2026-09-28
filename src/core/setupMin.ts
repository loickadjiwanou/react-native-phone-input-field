import metadata from 'libphonenumber-js/metadata.min.json';
import type { MetadataJson } from 'libphonenumber-js/core';

import { setPhoneMetadata } from './metadata';

setPhoneMetadata(metadata as unknown as MetadataJson);
