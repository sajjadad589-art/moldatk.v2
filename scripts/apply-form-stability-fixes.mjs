import fs from 'node:fs';

const patchFile = (path, from, to, label) => {
  let content = fs.readFileSync(path, 'utf8');
  if (content.includes(to)) {
    console.log(`${label} already applied`);
    return;
  }
  if (!content.includes(from)) throw new Error(`Missing patch marker: ${label}`);
  content = content.replace(from, to);
  fs.writeFileSync(path, content);
  console.log(`Applied ${label}`);
};

// Do not clear typed subscriber data when cloud sync refreshes pricing/lines arrays.
patchFile(
  'src/components/SubscriberModal.tsx',
  '  }, [subscriberToEdit, isOpen, pricingTiers, lines]);',
  '  }, [isOpen, subscriberToEdit?.id]);',
  'subscriber form draft stability'
);

// Do not reset the cabinet editor whenever realtime sync refreshes generator props.
// Re-initialize only when the modal is opened or the selected settings folder changes.
patchFile(
  'src/components/FolderDetailModal.tsx',
  '  }, [isOpen, generatorSpecs, lines, collectors, invoiceTemplate]);',
  '  }, [isOpen, folderKey]);',
  'cabinet editor stability'
);

console.log('Form stability fixes applied.');
