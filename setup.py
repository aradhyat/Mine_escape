import os

from setuptools import setup, find_packages

here = os.path.abspath(os.path.dirname(__file__))
README = open(os.path.join(here, 'README.txt')).read()
CHANGES = open(os.path.join(here, 'CHANGES.txt')).read()

requires = [
    'pyramid',
    'SQLAlchemy',
    'transaction',
    'pyramid_tm',
    'pyramid_debugtoolbar',
    'zope.sqlalchemy',
    'waitress',
    'mysql-python',
    'pyramid_beaker',
    'pyramid_mailer',
    'beautifulsoup4',
    'mailsnake',
    'formencode',
    'pyDNS',
    'requests',
    'pillow',
    'pystache',
    'html5lib',
    'python-dateutil',
    'tvdb_api',
    'recaptcha-client'
    ]

setup(name='mine_escape',
      version='0.0',
      description='mine_escape',
      long_description=README + '\n\n' +  CHANGES,
      classifiers=[
        "Programming Language :: Python",
        "Framework :: Pylons",
        "Topic :: Internet :: WWW/HTTP",
        "Topic :: Internet :: WWW/HTTP :: WSGI :: Application",
        ],
      author='',
      author_email='',
      url='',
      keywords='web wsgi bfg pylons pyramid',
      packages=find_packages(),
      include_package_data=True,
      zip_safe=False,
      test_suite='mine_escape',
      install_requires=requires,
      entry_points="""\
      [paste.app_factory]
      main = mine_escape:main
      [console_scripts]
      initialize_mine_escape_db = mine_escape.scripts.initializedb:main
      """,
      )

