from bs4 import BeautifulSoup
import requests
import sys


def find_article(word):
    source = requests.get(f'https://www.duden.de/suchen/dudenonline/{word}').text
    soup = BeautifulSoup(source, 'lxml')

    definitions = soup.find_all('a', class_='vignette__link')
    word_websites = []
    while'ä' in word or 'ö' in word or 'ü' in word or 'ß' in word or 'Ö'in word or 'Ü' in word or 'Ä'in word:
        word = word.replace("ä", "ae")
        word = word.replace("ö", "oe")
        word = word.replace("ü", "ue")
        word = word.replace("ß", "sz")
        word = word.replace("Ö", "Oe")
        word = word.replace("Ü", "Ue")
        word = word.replace("Ä", "Ae")
    for definition in definitions:
        link = definition['href']
        if link == f'/rechtschreibung/{word}' or link.startswith(f'/rechtschreibung/{word}_'):
            word_websites.append(f'https://www.duden.de{link}')
    meanings = []

    for website in word_websites:
        direct_soup = BeautifulSoup(requests.get(website).text, 'lxml')
        begriff = direct_soup.find('span', class_='lemma__main').text
        try:
            artikel = direct_soup.find('span', class_='lemma__determiner').text
        except AttributeError:
            continue
        definitions = []
        if direct_soup.find(id='bedeutung') is not None:
            if (definition := direct_soup.find(id='bedeutung').p) is not None:
                text_definition = definition.text
                definitions.append(text_definition)
        if (more_definitions := direct_soup.find_all(class_='enumeration__text')) is not None:
            for definition in more_definitions:
                definitions.append(definition.text)
        
        meanings.append([begriff, artikel, definitions])
    print (meanings)

find_article(str(sys.argv[-1]))
