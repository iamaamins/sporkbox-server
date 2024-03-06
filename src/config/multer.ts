import multer, { MulterError } from 'multer';

const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype === 'image/png' ||
      file.mimetype === 'image/jpg' ||
      file.mimetype === 'image/jpeg'
    ) {
      cb(null, true);
    } else {
      cb(null, false);
      cb(new MulterError('LIMIT_UNEXPECTED_FILE'));
    }
  },
}).single('file');
